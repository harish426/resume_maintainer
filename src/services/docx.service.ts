import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  TabStopType,
  ExternalHyperlink,
  UnderlineType,
} from "docx";
import { ResumeData } from "../types/resume";

export class DocxService {
  private INCHES_TO_TWIP = 1440;
  private CONTENT_WIDTH_TWIP = 7.2 * 1440; // 8.5" - 0.7" - 0.6"

  async generateResume(data: ResumeData): Promise<Blob> {
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 0.4 * this.INCHES_TO_TWIP,
                right: 0.6 * this.INCHES_TO_TWIP,
                bottom: 0.4 * this.INCHES_TO_TWIP,
                left: 0.7 * this.INCHES_TO_TWIP,
              },
            },
          },
          children: [
            ...this.createHeader(data),
            ...this.createSkills(data),
            ...this.createExperience(data),
            ...this.createProjects(data),
            ...this.createEducation(data),
          ],
        },
      ],
      styles: {
        default: {
          document: {
            run: {
              size: 18, // 9pt (The sweet spot)
              font: "Calibri",
            },
            paragraph: {
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 0, line: 240 }, // Single spacing
            },
          },
        },
      },
    });

    return await Packer.toBlob(doc);
  }

  private createSectionHeading(text: string): Paragraph[] {
    return [
      new Paragraph({
        spacing: { before: 100, after: 30 },
        border: {
          bottom: {
            color: "000000",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 2,
          },
        },
        children: [
          new TextRun({
            text: text.toUpperCase(),
            bold: true,
            size: 22, // 11pt for section headings
          }),
        ],
      }),
    ];
  }

  private createHeader(data: ResumeData): Paragraph[] {
    const info = data.personal_info;
    const paragraphs: Paragraph[] = [];

    // Name
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: info.name,
            bold: true,
            size: 32, // 16pt
          }),
        ],
      })
    );

    // Contact line
    const contactParts: (TextRun | ExternalHyperlink | string)[] = [];

    if (info.email) contactParts.push(new TextRun({ text: info.email, size: 18 }));
    if (info.phone) {
      if (contactParts.length > 0) contactParts.push(new TextRun({ text: " | ", size: 18 }));
      contactParts.push(new TextRun({ text: info.phone, size: 18 }));
    }

    const links = [
      { text: "LinkedIn", url: info.linkedin },
      { text: "Github", url: info.github },
      { text: "Portfolio", url: info.portfolio },
    ].filter(l => l.url);

    links.forEach((link, idx) => {
      if (contactParts.length > 0) contactParts.push(new TextRun({ text: " | ", size: 18 }));
      contactParts.push(
        new ExternalHyperlink({
          children: [
            new TextRun({
              text: link.text,
              size: 18,
              color: "0000FF",
              underline: { type: UnderlineType.SINGLE },
            }),
          ],
          link: link.url!,
        })
      );
    });

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: contactParts as any,
      })
    );

    return paragraphs;
  }

  private createSkills(data: ResumeData): Paragraph[] {
    const tech = data.technologies;
    const body: Paragraph[] = [...this.createSectionHeading("Technical Skills")];

    for (const [category, skills] of Object.entries(tech)) {
      body.push(
        new Paragraph({
          indent: { left: 288, hanging: 144 },
          bullet: { level: 0 },
          children: [
            new TextRun({ text: `${category}: `, bold: true, size: 18 }),
            new TextRun({ text: Array.isArray(skills) ? skills.join(", ") : String(skills), size: 18 }),
          ],
        })
      );
    }
    return body;
  }

  private createExperience(data: ResumeData): Paragraph[] {
    const exp = data.professional_experience;
    const body: Paragraph[] = [...this.createSectionHeading("Professional Experience")];

    for (const job of exp) {
      body.push(
        new Paragraph({
          spacing: { before: 70 },
          tabStops: [
            {
              type: TabStopType.RIGHT,
              position: this.CONTENT_WIDTH_TWIP,
            },
          ],
          children: [
            new TextRun({
              text: `${job.client || ""}, ${job.location || ""}`,
              bold: true,
              size: 20, // 10pt
            }),
            new TextRun({ text: " | ", size: 20 }),
            new TextRun({ text: job.role || "", size: 20 }),
            new TextRun({ text: `\t${job.duration || ""}`, size: 18 }),
          ],
        })
      );

      for (const resp of job.responsibilities) {
        body.push(
          new Paragraph({
            indent: { left: 288, hanging: 144 },
            bullet: { level: 0 },
            children: [new TextRun({ text: resp, size: 18 })],
          })
        );
      }
    }
    return body;
  }

  private createProjects(data: ResumeData): Paragraph[] {
    const projects = data.projects;
    const body: Paragraph[] = [...this.createSectionHeading("Projects")];

    for (const proj of projects) {
      const name = proj.name || "";
      const url = proj.url;
      const projectChildren: (TextRun | ExternalHyperlink)[] = [];

      if (url && name.includes("(") && name.includes(")")) {
        const startIdx = name.indexOf("(");
        const endIdx = name.indexOf(")") + 1;

        const before = name.substring(0, startIdx);
        const linkText = name.substring(startIdx, endIdx);
        const after = name.substring(endIdx);

        if (before) projectChildren.push(new TextRun({ text: before, bold: true, size: 18 }));
        projectChildren.push(new ExternalHyperlink({
          children: [
            new TextRun({
              text: linkText,
              bold: true,
              size: 18,
              color: "0000FF",
              underline: { type: UnderlineType.SINGLE },
            }),
          ],
          link: url,
        }));
        if (after) projectChildren.push(new TextRun({ text: after, bold: true, size: 18 }));
      } else if (url) {
        projectChildren.push(new ExternalHyperlink({
          children: [
            new TextRun({
              text: name,
              bold: true,
              size: 18,
              color: "0000FF",
              underline: { type: UnderlineType.SINGLE },
            }),
          ],
          link: url,
        }));
      } else {
        projectChildren.push(new TextRun({ text: name, bold: true, size: 18 }));
      }

      body.push(
        new Paragraph({
          spacing: { before: 80 },
          children: projectChildren,
        })
      );

      for (const desc of proj.description) {
        body.push(
          new Paragraph({
            indent: { left: 288, hanging: 144 },
            bullet: { level: 0 },
            children: [new TextRun({ text: desc, size: 18 })],
          })
        );
      }
    }
    return body;
  }

  private createEducation(data: ResumeData): Paragraph[] {
    const edu = data.education_list || [];
    const body: Paragraph[] = [...this.createSectionHeading("Education")];

    for (const entry of edu) {
      body.push(
        new Paragraph({
          spacing: { before: 80 },
          tabStops: [
            { type: TabStopType.RIGHT, position: this.CONTENT_WIDTH_TWIP }
          ],
          children: [
            new TextRun({ text: entry.institution || "", bold: true, size: 20 }),
            new TextRun({ text: `\t${entry.location || ""}`, bold: true, size: 20 })
          ]
        })
      );

      body.push(
        new Paragraph({
          tabStops: [
            { type: TabStopType.RIGHT, position: this.CONTENT_WIDTH_TWIP }
          ],
          children: [
            new TextRun({ text: entry.degree || "", size: 18 }),
            new TextRun({ text: `\t${entry.duration || ""}`, size: 18 })
          ]
        })
      );
    }
    return body;
  }
}
