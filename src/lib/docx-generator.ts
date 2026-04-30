import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { saveAs } from "file-saver";
import { forceRtlDocxZip } from "@/lib/docx-rtl";

/**
 * DocxGenerator - Service class for generating DOCX files from templates
 */
export class DocxGenerator {
  constructor(templatePath: string = "/templates/regular-order.docx") {
    this.templatePath = templatePath;
  }

  private templatePath: string;

  /**
   * Generate and download a DOCX file from template and data
   */
  async generate(
    data: Record<string, any>,
    fileName?: string,
    templatePath?: string,
  ): Promise<void> {
    try {
      const template = templatePath || this.templatePath;
      const response = await fetch(template);
      if (!response.ok) {
        throw new Error(`Failed to load template: HTTP ${response.status}`);
      }
      const content = await response.arrayBuffer();

      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: "{", end: "}" },
      });

      doc.render(data);
      const renderedZip = doc.getZip();
      forceRtlDocxZip(renderedZip);

      const out = renderedZip.generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        compression: "DEFLATE",
      });

      const defaultFileName = this.generateFileName(data);
      saveAs(out, fileName || defaultFileName);
    } catch (error) {
      console.error("Error generating DOCX:", error);
      if ((error as any).properties?.errors) {
        console.error("Docxtemplater Errors:", (error as any).properties.errors);
      }
      throw new Error("אירעה שגיאה ביצירת הדוח. ודא שהתבנית תקינה ושכל התגיות מולאו.");
    }
  }

  /**
   * Generate a meaningful file name from the data
   */
  private generateFileName(data: Record<string, any>): string {
    const parts = ["דוח_הזמנה"];
    
    const clientName = data.client_name || data.customer_name;

    if (clientName) {
      parts.push(clientName);
    }
    
    if (data.order_number) {
      parts.push(data.order_number);
    }

    const timestamp = new Date().toISOString().split('T')[0];
    parts.push(timestamp);

    return `${parts.join("_")}.docx`;
  }
}

/**
 * Singleton instance for easy usage
 */
export const docxGenerator = new DocxGenerator();
