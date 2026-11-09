import handle from "../../index.js";

export default async (request, context) => handle(request);

export const config = { path: "/*" };
