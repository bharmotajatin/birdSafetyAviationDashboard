/** Capture off-screen SafetyReportPDF pages with html2canvas + jsPDF (never window.print). */
export async function exportSafetyReportPdf(): Promise<void> {
  const root = document.getElementById("safety-report-pdf-root");
  if (!root) {
    throw new Error("PDF root element not found. Refresh the page and try again.");
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const pages = root.querySelectorAll<HTMLElement>(".report-page");
  if (pages.length === 0) {
    throw new Error("No report pages found in PDF template.");
  }

  // Visible for layout/render only — stays off-screen and behind the live UI
  root.style.display = "block";
  root.style.visibility = "visible";
  root.style.position = "fixed";
  root.style.left = "-9999px";
  root.style.top = "0";
  root.style.zIndex = "-1";
  root.style.width = "794px";
  root.style.pointerEvents = "none";

  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    for (let index = 0; index < pages.length; index += 1) {
      const canvas = await html2canvas(pages[index], {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        width: 794,
        height: 1123,
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
        logging: false,
      });

      if (index > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/png", 1.0), "PNG", 0, 0, 210, 297);
    }

    const date = new Date().toISOString().split("T")[0];
    pdf.save(`BirdFlightServices_SafetyReport_DEL_${date}.pdf`);
  } finally {
    root.style.visibility = "hidden";
  }
}
