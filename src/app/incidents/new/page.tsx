"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const STEPS = [
  { id: 1, title: "Basic Details" },
  { id: 2, title: "Incident Details" },
  { id: 3, title: "Person Involved" },
  { id: 4, title: "Photo Upload" },
  { id: 5, title: "Review & Submit" },
] as const;

const OPERATIONS = [
  "Pre-Arrival",
  "Arrival",
  "Turnaround",
  "Loading/Unloading",
  "Pushback",
  "Taxi-Out",
  "Other",
] as const;

const INCIDENT_TYPES = [
  "Staff Injury",
  "Near Miss",
  "A/C Damage",
  "GSE Incident",
  "Loading Error",
  "Slip/Trip",
  "ULD Damage",
  "Cargo Hold Damage",
  "Aircraft Related",
  "Communication Failure",
  "Pallet Tilted",
  "Airport Property Damaged",
  "GSE Collision",
  "Other",
] as const;

const CATEGORIES = [
  { value: "CAT-A", desc: "Critical incident requiring immediate response" },
  { value: "CAT-B", desc: "High priority incident with significant risk" },
  { value: "CAT-C", desc: "Moderate incident requiring investigation" },
  { value: "CAT-D", desc: "Low severity incident for tracking and prevention" },
] as const;

const BODY_PARTS = [
  "Head",
  "Eye",
  "Ear",
  "Neck",
  "Shoulder",
  "Arm",
  "Elbow",
  "Hand",
  "Finger",
  "Chest",
  "Back",
  "Leg",
  "Knee",
  "Ankle",
  "Foot",
  "Other",
] as const;

const DRAFT_KEY = "bfs_incident_report_draft_v1";

const photoSchema = z.object({
  filename: z.string(),
  originalName: z.string(),
  url: z.string().url(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  caption: z.string().default(""),
});

const schema = z.object({
  ghrNo: z.string(),
  dateOfIncident: z.string().min(1, "Date is required"),
  timeOfIncident: z.string().min(1, "Time is required"),
  stationId: z.string().min(1, "Station is required"),
  departmentId: z.string().min(1, "Department is required"),
  locationText: z.string().min(1, "Location is required"),
  locationBay: z.string().min(1, "Bay is required"),
  locationGate: z.string().min(1, "Gate is required"),
  operationalPhase: z.enum(OPERATIONS),
  incidentTitle: z.string().min(5, "Incident title is required"),
  incidentType: z.enum(INCIDENT_TYPES),
  incidentCategory: z.enum(["CAT-A", "CAT-B", "CAT-C", "CAT-D"]),
  incidentBrief: z
    .string()
    .min(1, "Incident brief is required")
    .refine((value) => value.trim().split(/\s+/).filter(Boolean).length >= 500, "Incident brief must be at least 500 words"),
  weatherConditions: z.string().min(1, "Weather conditions are required"),
  equipmentInvolved: z.string().min(1, "Equipment involved is required"),
  personName: z.string().min(1, "Name is required"),
  designation: z.string().min(1, "Designation is required"),
  employeeNo: z.string().min(1, "Employee number is required"),
  age: z.coerce.number().min(18, "Age must be at least 18"),
  gender: z.string().min(1, "Gender is required"),
  yearsExperience: z.coerce.number().min(0),
  bodyPart: z.enum(BODY_PARTS),
  injurySeverity: z.string().min(1, "Injury severity is required"),
  immediateTreatment: z.string().min(1, "Immediate treatment details required"),
  hospitalName: z.string().min(1, "Hospital info required (use N/A if not applicable)"),
  photos: z.array(photoSchema).min(1, "Upload at least one file"),
});

type FormValues = z.infer<typeof schema>;

type StationOption = { _id: string; code: string; name: string; fullName: string };
type DepartmentOption = { _id: string; code: string; name: string };
type UploadedFile = z.infer<typeof photoSchema>;

const FIELD_GROUPS: Record<number, Array<keyof FormValues>> = {
  1: ["dateOfIncident", "timeOfIncident", "stationId", "departmentId", "locationText", "locationBay", "locationGate", "operationalPhase", "incidentTitle"],
  2: ["incidentType", "incidentCategory", "incidentBrief", "weatherConditions", "equipmentInvolved"],
  3: ["personName", "designation", "employeeNo", "age", "gender", "yearsExperience", "bodyPart", "injurySeverity", "immediateTreatment", "hospitalName"],
  4: ["photos"],
  5: [],
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-sm font-semibold text-[#1a2a5e]">
      {children} <span style={{ color: "#dc2626" }}>*</span>
    </label>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <span title={text} className="ml-1 inline-flex text-slate-400">
      <HelpCircle size={13} />
    </span>
  );
}

export default function NewIncidentPage() {
  const [step, setStep] = useState(1);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ ghrNo: string } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      ghrNo: "AUTO-GENERATED ON SUBMIT",
      dateOfIncident: "",
      timeOfIncident: "",
      stationId: "",
      departmentId: "",
      locationText: "",
      locationBay: "",
      locationGate: "",
      operationalPhase: "Turnaround",
      incidentTitle: "",
      incidentType: "Staff Injury",
      incidentCategory: "CAT-C",
      incidentBrief: "",
      weatherConditions: "",
      equipmentInvolved: "",
      personName: "",
      designation: "",
      employeeNo: "",
      age: 18,
      gender: "",
      yearsExperience: 0,
      bodyPart: "Hand",
      injurySeverity: "",
      immediateTreatment: "",
      hospitalName: "",
      photos: [],
    },
    mode: "onBlur",
  });

  const photos = watch("photos");
  const incidentBrief = watch("incidentBrief");
  const briefWordCount = useMemo(
    () => incidentBrief.trim().split(/\s+/).filter(Boolean).length,
    [incidentBrief],
  );

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<FormValues>;
        (Object.keys(parsed) as Array<keyof FormValues>).forEach((key) => {
          if (parsed[key] !== undefined) setValue(key, parsed[key] as never);
        });
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, [setValue]);

  useEffect(() => {
    const save = () => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(getValues()));
    };
    const timer = window.setInterval(save, 30_000);
    return () => window.clearInterval(timer);
  }, [getValues]);

  useEffect(() => {
    const loadMeta = async () => {
      const [metaRes, sessionRes] = await Promise.all([
        fetch("/api/incidents/meta"),
        fetch("/api/auth/session"),
      ]);
      let metaData: { stations?: StationOption[]; departments?: DepartmentOption[] } = {};
      if (metaRes.ok) {
        metaData = await metaRes.json();
        setStations(metaData.stations ?? []);
        setDepartments(metaData.departments ?? []);
      }
      if (sessionRes.ok) {
        const session = await sessionRes.json();
        const stationCode = session?.user?.station as string | undefined;
        if (stationCode) {
          const station = metaData.stations?.find((s: StationOption) => s.code === stationCode);
          if (station?._id) setValue("stationId", station._id);
        }
      }
    };
    void loadMeta();
  }, [setValue]);

  async function uploadFiles(files: FileList | File[]) {
    const next = Array.from(files);
    if (!next.length) return;
    if (photos.length + next.length > 10) {
      setSubmitError("Maximum 10 files allowed.");
      return;
    }

    const formData = new FormData();
    next.forEach((file) => formData.append("files", file));
    formData.append("captions", JSON.stringify(next.map(() => "")));

    setIsUploading(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      const merged = [...photos, ...(json.files as UploadedFile[])];
      setValue("photos", merged, { shouldValidate: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function nextStep() {
    const fields = FIELD_GROUPS[step];
    const ok = await trigger(fields);
    if (!ok) return;
    setStep((curr) => Math.min(curr + 1, STEPS.length));
  }

  function previousStep() {
    setStep((curr) => Math.max(curr - 1, 1));
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const payload = {
        dateOfIncident: values.dateOfIncident,
        timeOfIncident: values.timeOfIncident,
        station: values.stationId,
        department: values.departmentId,
        location: {
          text: values.locationText,
          bay: values.locationBay,
          gate: values.locationGate,
          zone: "",
        },
        operationalPhase: values.operationalPhase,
        incidentTitle: values.incidentTitle,
        incidentType: values.incidentType,
        incidentCategory: values.incidentCategory,
        incidentBrief: values.incidentBrief,
        weatherConditions: values.weatherConditions,
        equipmentInvolved: values.equipmentInvolved,
        personInvolved: {
          name: values.personName,
          designation: values.designation,
          staffNo: values.employeeNo,
          age: values.age,
          gender: values.gender,
          yearsExperience: values.yearsExperience,
        },
        injuryDetails: {
          bodyPart: values.bodyPart,
          severity: values.injurySeverity,
          treatment: `${values.immediateTreatment}. Hospital: ${values.hospitalName}`,
        },
        attachments: values.photos.map((file: UploadedFile) => file.filename).filter(Boolean),
      };

      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create incident");

      localStorage.removeItem(DRAFT_KEY);
      setSuccess({ ghrNo: json.incident.ghrNo });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Submit failed");
    }
  });

  if (success) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-[#d4af37]/40 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[#1a2a5e]">Incident Submitted Successfully</h1>
          <p className="mt-2 text-slate-600">
            New GHR Number: <span className="font-semibold text-[#1a2a5e]">{success.ghrNo}</span>
          </p>
          <Link
            href={`/incident-log?highlight=${encodeURIComponent(success.ghrNo)}`}
            className="mt-6 inline-flex rounded-lg bg-[#1a2a5e] px-4 py-2 text-sm font-semibold text-[#d4af37]"
          >
            View Incident →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-[#1a2a5e]">New Incident Report</h1>
        <p className="mt-1 text-sm text-slate-500">Safety Management System · Multi-step report form</p>

        <div className="mt-5 rounded-xl border border-[#e2e8f0] bg-white p-4">
          <div className="mb-3 h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-[#d4af37] transition-all duration-300"
              style={{ width: `${(step / STEPS.length) * 100}%` }}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-5">
            {STEPS.map((item) => (
              <div
                key={item.id}
                className={`rounded-md px-2 py-1 text-xs font-semibold ${step >= item.id ? "bg-[#1a2a5e] text-[#d4af37]" : "bg-slate-100 text-slate-500"}`}
              >
                {item.id}. {item.title}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-5 rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {step === 1 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>GHR No.</Label>
                    <input readOnly {...register("ghrNo")} className="w-full rounded-lg border border-[#d8deec] bg-slate-50 px-3 py-2 text-sm" />
                  </div>
                  <div />
                  <div>
                    <Label>Date of Incident</Label>
                    <input type="date" {...register("dateOfIncident")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" />
                    {errors.dateOfIncident ? <p className="mt-1 text-xs text-red-600">{errors.dateOfIncident.message}</p> : null}
                  </div>
                  <div>
                    <Label>Time of Incident</Label>
                    <input type="time" {...register("timeOfIncident")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" />
                    {errors.timeOfIncident ? <p className="mt-1 text-xs text-red-600">{errors.timeOfIncident.message}</p> : null}
                  </div>
                  <div>
                    <Label>Station</Label>
                    <select {...register("stationId")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm">
                      <option value="">Select station</option>
                      {stations.map((s) => (
                        <option key={s._id} value={s._id}>{s.code} — {s.fullName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Department</Label>
                    <select {...register("departmentId")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm">
                      <option value="">Select department</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>{d.code} — {d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Location <Tooltip text="Primary location of occurrence." /></Label>
                    <input {...register("locationText")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Bay</Label>
                      <input {...register("locationBay")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <Label>Gate</Label>
                      <input {...register("locationGate")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <Label>Operational Phase <Tooltip text="Phase during which incident occurred." /></Label>
                    <select {...register("operationalPhase")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm">
                      {OPERATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Incident Title</Label>
                    <input {...register("incidentTitle")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" />
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Incident Type</Label>
                    <select {...register("incidentType")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm">
                      {INCIDENT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Incident Category</Label>
                    <select {...register("incidentCategory")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm">
                      {CATEGORIES.map((item) => (
                        <option key={item.value} value={item.value}>{item.value} — {item.desc}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Incident Brief (min 500 words)</Label>
                    <textarea rows={10} {...register("incidentBrief")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" />
                    <p className="mt-1 text-xs text-slate-500">Word count: {briefWordCount}</p>
                    {errors.incidentBrief ? <p className="mt-1 text-xs text-red-600">{errors.incidentBrief.message}</p> : null}
                  </div>
                  <div>
                    <Label>Weather Conditions</Label>
                    <input {...register("weatherConditions")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <Label>Equipment Involved</Label>
                    <input {...register("equipmentInvolved")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" />
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div><Label>Name</Label><input {...register("personName")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" /></div>
                  <div><Label>Designation</Label><input {...register("designation")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" /></div>
                  <div><Label>Employee Number</Label><input {...register("employeeNo")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label>Age</Label><input type="number" {...register("age")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" /></div>
                    <div><Label>Gender</Label><input {...register("gender")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" /></div>
                    <div><Label>Experience (yrs)</Label><input type="number" {...register("yearsExperience")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" /></div>
                  </div>
                  <div><Label>Body Part</Label><select {...register("bodyPart")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm">{BODY_PARTS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                  <div><Label>Severity</Label><input {...register("injurySeverity")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" /></div>
                  <div className="md:col-span-2"><Label>Immediate Treatment Given</Label><textarea rows={3} {...register("immediateTreatment")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" /></div>
                  <div className="md:col-span-2"><Label>Hospital (if any)</Label><input {...register("hospitalName")} className="w-full rounded-lg border border-[#d8deec] px-3 py-2 text-sm" /></div>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      void uploadFiles(e.dataTransfer.files);
                    }}
                    className="rounded-xl border-2 border-dashed border-[#b9c4dd] p-8 text-center"
                  >
                    <UploadCloud className="mx-auto mb-2 text-[#1a2a5e]" />
                    <p className="text-sm font-semibold text-[#1a2a5e]">Drag and drop up to 10 files</p>
                    <p className="text-xs text-slate-500">JPG / PNG / PDF · Max 5MB each</p>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) void uploadFiles(e.target.files);
                      }}
                      className="mt-3 block w-full text-xs"
                    />
                  </div>
                  {isUploading ? <p className="text-sm text-[#1a2a5e]">Uploading files...</p> : null}
                  {errors.photos ? <p className="text-xs text-red-600">{errors.photos.message as string}</p> : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    {photos.map((file, idx) => (
                      <div key={`${file.filename}-${idx}`} className="rounded-lg border border-[#e2e8f0] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-slate-600">{file.originalName}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...photos];
                              next.splice(idx, 1);
                              setValue("photos", next, { shouldValidate: true });
                            }}
                            className="text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                        {file.mimeType.startsWith("image/") ? (
                          <img src={file.url} alt={file.originalName} className="h-28 w-full rounded-md object-cover" />
                        ) : (
                          <a href={file.url} target="_blank" className="text-xs text-[#1a2a5e] underline" rel="noreferrer">
                            View uploaded PDF
                          </a>
                        )}
                        <input
                          value={file.caption}
                          onChange={(e) => {
                            const next = [...photos];
                            next[idx] = { ...next[idx], caption: e.target.value };
                            setValue("photos", next);
                          }}
                          placeholder="Add caption"
                          className="mt-2 w-full rounded-md border border-[#d8deec] px-2 py-1.5 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#e2e8f0] bg-slate-50 p-4 text-sm">
                    <h3 className="mb-2 text-base font-semibold text-[#1a2a5e]">Review Summary</h3>
                    <div className="grid gap-2 md:grid-cols-2">
                      <p><strong>Title:</strong> {watch("incidentTitle")}</p>
                      <p><strong>Date & Time:</strong> {watch("dateOfIncident")} {watch("timeOfIncident")}</p>
                      <p><strong>Station:</strong> {stations.find((s) => s._id === watch("stationId"))?.code ?? "-"}</p>
                      <p><strong>Department:</strong> {departments.find((d) => d._id === watch("departmentId"))?.code ?? "-"}</p>
                      <p><strong>Category:</strong> {watch("incidentCategory")}</p>
                      <p><strong>Type:</strong> {watch("incidentType")}</p>
                      <p><strong>Person:</strong> {watch("personName")} ({watch("designation")})</p>
                      <p><strong>Files:</strong> {photos.length}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {STEPS.slice(0, 4).map((item) => (
                        <button key={item.id} type="button" onClick={() => setStep(item.id)} className="rounded-md border border-[#d4af37]/40 px-3 py-1 text-xs font-semibold text-[#1a2a5e]">
                          Edit Step {item.id}
                        </button>
                      ))}
                    </div>
                  </div>
                  {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={previousStep}
              disabled={step === 1}
              className="rounded-lg border border-[#d8deec] px-4 py-2 text-sm font-semibold text-[#1a2a5e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={() => void nextStep()}
                className="rounded-lg bg-[#1a2a5e] px-4 py-2 text-sm font-semibold text-[#d4af37]"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-[#1a2a5e] px-4 py-2 text-sm font-semibold text-[#d4af37] disabled:opacity-70"
              >
                {isSubmitting ? "Submitting..." : "Submit Incident Report"}
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </main>
  );
}
