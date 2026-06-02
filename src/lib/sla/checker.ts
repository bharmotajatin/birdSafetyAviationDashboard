import nodemailer from "nodemailer";
import { dbConnect } from "@/lib/db";
import { Incident } from "@/lib/db/models/Incident";
import { Notification } from "@/lib/db/models/Notification";
import { Settings } from "@/lib/db/models/Settings";
import { Station } from "@/lib/db/models/Station";
import { TimelineEvent } from "@/lib/db/models/TimelineEvent";
import { User } from "@/lib/db/models/User";

type SlaHoursMap = Record<string, number>;

function buildTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function notifyOverdue(
  recipients: Array<{ _id: any; email?: string | null; name?: string | null }>,
  incident: any,
  overdueHours: number,
) {
  const transporter = buildTransporter();
  const from = process.env.EMAIL_FROM ?? "safety@birdflightservices.com";

  for (const recipient of recipients) {
    if (!recipient?._id) continue;
    await Notification.create({
      userId: recipient._id,
      type: "sla_breach",
      title: `SLA breach: ${incident.ghrNo}`,
      message: `Incident ${incident.ghrNo} is overdue by ${overdueHours} hours.`,
      incidentId: incident._id,
    });

    if (transporter && recipient.email) {
      await transporter.sendMail({
        from,
        to: recipient.email,
        subject: `[BFS SMS] SLA breach for ${incident.ghrNo}`,
        text: `Hello ${recipient.name ?? "Team"},\n\nIncident ${incident.ghrNo} is overdue by ${overdueHours} hours.\nTitle: ${incident.incidentTitle}\nStatus: ${incident.status}\n\nPlease take immediate action.`,
      });
    }
  }
}

export async function runSlaCheck() {
  await dbConnect();

  const settings = await Settings.findOne({ key: "sla.hoursByCategory" }).lean();
  const slaMap: SlaHoursMap = (settings?.value as SlaHoursMap | undefined) ?? {
    "CAT-A": 24,
    "CAT-B": 72,
    "CAT-C": 168,
    "CAT-D": 336,
  };

  const incidents = await Incident.find({
    isDeleted: { $ne: true },
    status: { $in: ["Open", "In Progress", "Pending", "Reviewed"] },
  }).lean();

  let checked = 0;
  let overdueNow = 0;
  let newlyFlagged = 0;

  for (const incident of incidents) {
    checked += 1;
    const allowedHours = Number(slaMap[incident.incidentCategory] ?? 24);
    const elapsedHours = Math.floor((Date.now() - new Date(incident.createdAt).getTime()) / 3600000);
    const isOverdue = elapsedHours > allowedHours;

    if (isOverdue) overdueNow += 1;

    const update: Record<string, unknown> = {
      isOverdueSLA: isOverdue,
      slaDeadline: new Date(new Date(incident.createdAt).getTime() + allowedHours * 3600000),
    };

    if (isOverdue && !incident.isOverdueSLA) {
      newlyFlagged += 1;
      await TimelineEvent.create({
        incidentId: incident._id,
        eventType: "comment",
        description: `SLA breach detected. Incident overdue by ${elapsedHours - allowedHours} hours.`,
        performedBy: incident.createdBy,
        oldValue: { isOverdueSLA: false },
        newValue: { isOverdueSLA: true },
      });

      const station = incident.station ? await Station.findById(incident.station).lean() : null;
      const recipients = await User.find({
        _id: {
          $in: [incident.assignedInvestigator, station?.safetyHeadUserId].filter(Boolean),
        },
      })
        .select("_id email name")
        .lean();

      await notifyOverdue(recipients, incident, elapsedHours - allowedHours);
    }

    await Incident.updateOne({ _id: incident._id }, { $set: update });
  }

  return {
    checked,
    overdueNow,
    newlyFlagged,
    ranAt: new Date().toISOString(),
  };
}
