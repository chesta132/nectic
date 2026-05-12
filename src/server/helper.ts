import busboy from "busboy";
import { NextApiRequest } from "next";

export const parseFormData = (req: NextApiRequest) => {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    const fields: Record<string, any> = {};
    const filePromises: Promise<void>[] = [];

    bb.on("file", (name, stream, info) => {
      const { filename, mimeType } = info;
      const chunks: Buffer[] = [];

      const filePromise = new Promise<void>((res) => {
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const file = new File([buffer], filename || "upload", {
            type: mimeType || "application/octet-stream",
          });
          if (fields[name]) {
            fields[name] = Array.isArray(fields[name]) ? [...fields[name], file] : [fields[name], file];
          } else {
            fields[name] = file;
          }
          res();
        });
      });

      filePromises.push(filePromise);
    });

    bb.on("field", (name: string, value: string) => {
      fields[name] = value;
    });

    bb.on("finish", async () => {
      await Promise.all(filePromises);
      resolve(fields);
    });

    bb.on("error", reject);
    req.pipe(bb);
  });
};

export async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
