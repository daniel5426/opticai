import type PizZip from "pizzip";

const WORD_XML_FILE_PATTERN =
  /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/;

const RTL_PARAGRAPH_PROPS = '<w:bidi w:val="1"/><w:jc w:val="left"/>';

function forceParagraphPropertiesRtl(propertyBlock: string): string {
  const openingTag = propertyBlock.match(/^<w:pPr(?:\s[^>]*)?>/)?.[0];
  if (!openingTag) return propertyBlock;

  const cleanedBlock = propertyBlock
    .replace(/<w:jc\b[^/]*(?:\/>|>[\s\S]*?<\/w:jc>)/g, "")
    .replace(/<w:bidi\b[^/]*(?:\/>|>[\s\S]*?<\/w:bidi>)/g, "");

  return cleanedBlock.replace(openingTag, `${openingTag}${RTL_PARAGRAPH_PROPS}`);
}

function forceParagraphRtl(paragraphXml: string): string {
  const paragraphPropsPattern = /<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/;
  if (paragraphPropsPattern.test(paragraphXml)) {
    return paragraphXml.replace(paragraphPropsPattern, forceParagraphPropertiesRtl);
  }

  return paragraphXml.replace(
    /<w:p(?=[\s>])[^>]*>/,
    (openingTag) => `${openingTag}<w:pPr>${RTL_PARAGRAPH_PROPS}</w:pPr>`,
  );
}

function forceSectionRtl(sectionPropsXml: string): string {
  if (/<w:bidi\b/.test(sectionPropsXml)) return sectionPropsXml;

  return sectionPropsXml.replace(
    /<w:sectPr(?:\s[^>]*)?>/,
    (openingTag) => `${openingTag}<w:bidi w:val="1"/>`,
  );
}

export function forceRtlDocxXml(xml: string): string {
  return xml
    .replace(/<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g, forceParagraphRtl)
    .replace(/<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>/g, forceSectionRtl);
}

export function forceRtlDocxZip(zip: PizZip): void {
  Object.keys(zip.files).forEach((fileName) => {
    const file = zip.file(fileName);
    if (!file) return;

    if (WORD_XML_FILE_PATTERN.test(fileName)) {
      zip.file(fileName, forceRtlDocxXml(file.asText()));
    }
  });
}
