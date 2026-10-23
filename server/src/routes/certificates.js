import { Router } from "express";
import PDFDocument from "pdfkit";
import { Enrollment } from "../models/Enrollment.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/enrollments/:id/certificate", requireAuth, async (request, response, next) => {
  try {
    const enrollment = await Enrollment.findOne({
      _id: request.params.id,
      student: request.user._id,
      status: "completed",
    }).populate("student", "name").populate("course", "title instructor");
    if (!enrollment) {
      response.status(404).json({ error: "A completed enrollment is required for a certificate." });
      return;
    }
    enrollment.certificate.issuedAt ??= new Date();
    await enrollment.save();
    const safeName = enrollment.course.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "");
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="certificate-${safeName}.pdf"`);
    const pdf = new PDFDocument({ size: "A4", layout: "landscape", margin: 48 });
    pdf.on("error", next);
    pdf.pipe(response);
    pdf.fontSize(18).fillColor("#7161df").text("LEARNSPACE", { align: "center" });
    pdf.moveDown(2).fontSize(34).fillColor("#202239").text("Certificate of Completion", { align: "center" });
    pdf.moveDown().fontSize(16).fillColor("#666").text("This certifies that", { align: "center" });
    pdf.moveDown(0.5).fontSize(30).fillColor("#202239").text(enrollment.student.name, { align: "center" });
    pdf.moveDown(0.5).fontSize(16).fillColor("#666").text("has successfully completed", { align: "center" });
    pdf.moveDown(0.5).fontSize(24).fillColor("#7161df").text(enrollment.course.title, { align: "center" });
    pdf.moveDown(2).fontSize(12).fillColor("#777").text(
      `Completed ${new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(enrollment.completedAt ?? new Date())}`,
      { align: "center" }
    );
    pdf.end();
  } catch (error) {
    next(error);
  }
});

export default router;
