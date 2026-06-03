import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export const maxDuration = 60; // Allow up to 60 seconds for PDF generation

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const programs = searchParams.get("programs") ?? "";
    const startDate = searchParams.get("startDate") ?? "";
    const endDate = searchParams.get("endDate") ?? "";
    const includeServices = searchParams.get("includeServices") ?? "false";

    // Build preview URL
    const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:3000`;
    const previewParams = new URLSearchParams();
    if (programs) previewParams.set("programs", programs);
    if (startDate) previewParams.set("startDate", startDate);
    if (endDate) previewParams.set("endDate", endDate);
    previewParams.set("includeServices", includeServices);

    const previewUrl = `${baseUrl}/report/preview?${previewParams.toString()}`;

    console.log("Generating PDF from:", previewUrl);

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    try {
      const page = await browser.newPage();

      // Set authentication cookie/header if needed
      // For now, we'll rely on the preview page doing its own auth check
      
      // Navigate to preview page
      await page.goto(previewUrl, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });

      // Generate PDF
      const pdf = await page.pdf({
        format: "Letter",
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: "0.5in",
          right: "0.5in",
          bottom: "0.5in",
          left: "0.5in",
        },
      });

      await browser.close();

      // Return PDF - Convert Uint8Array to Buffer
      const filename = `FSC_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      await browser.close();
      throw error;
    }
  } catch (error) {
    console.error("PDF generation error:", error);
    return new NextResponse(
      `Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 }
    );
  }
}
