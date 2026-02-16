declare module "markdown-it" {
  type MarkdownItOptions = {
    html?: boolean;
    linkify?: boolean;
    typographer?: boolean;
  };

  export default class MarkdownIt {
    constructor(options?: MarkdownItOptions);
    render(input: string): string;
  }
}

declare module "pdf-parse" {
  type PdfParseResult = {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  };

  function pdfParse(dataBuffer: Buffer | Uint8Array): Promise<PdfParseResult>;

  export default pdfParse;
}
