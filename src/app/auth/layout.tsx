import { BrandCorner } from "@/components/brand-corner";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <BrandCorner>{children}</BrandCorner>;
}
