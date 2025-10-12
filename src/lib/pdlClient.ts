import PDLJS from "peopledatalabs";

export const PDLJSClient = new PDLJS({
  apiKey: process.env.PEOPLE_DATA_API_KEY!,
});
