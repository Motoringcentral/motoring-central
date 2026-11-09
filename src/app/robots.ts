import type { MetadataRoute } from "next";
import { IS_PREVIEW } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (IS_PREVIEW) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/book/"] } };
}
