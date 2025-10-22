import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { saveAs } from "file-saver";

/**
 * DocxGenerator - Service class for generating DOCX files from templates
 */
export class DocxGenerator {
  private templatePath: string;

  constructor(templatePath: string = "/templates/template.docx") {
    this.templatePath = templatePath;
  }

  /**
   * Load the template file
   */
  private async loadTemplate(): Promise<ArrayBuffer> {
    try {
      const response = await fetch(this.templatePath);
      
      if (!response.ok) {
        throw new Error(
          `Failed to load template: HTTP ${response.status}. Check that the file exists at: ${this.templatePath}`
        );
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error("Error loading template:", error);
      throw new Error("שגיאה בטעינת קובץ התבנית. ודא שהקובץ קיים.");
    }
  }

  /**
   * Generate and download a DOCX file from template and data
   */
  async generate(data: Record<string, any>, fileName?: string, templatePath?: string): Promise<void> {
    try {
      // Use custom template if provided, otherwise use default
      const template = templatePath || this.templatePath;
      
      // Load template
      const response = await fetch(template);
      if (!response.ok) {
        throw new Error(`Failed to load template: HTTP ${response.status}`);
      }
      const content = await response.arrayBuffer();

      // Create docxtemplater instance
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: "{", end: "}" },
      });

      // Merge data into template
      doc.render(data);

      // Generate binary file
      const out = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        compression: "DEFLATE",
      });

      // Download file
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
    
    if (data.customer_name) {
      parts.push(data.customer_name);
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

