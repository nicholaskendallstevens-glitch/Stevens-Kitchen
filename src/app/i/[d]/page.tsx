import { redirect } from "next/navigation";

// Short, iOS-safe entry point for the Safari shortcut: /i/<base64url payload>
// (Shortcuts cuts URLs at "=" / "%", so the data travels in the path.)
export default async function ShortcutEntry({ params }: { params: Promise<{ d: string }> }) {
  const { d } = await params;
  redirect(`/recipes/import?page=${encodeURIComponent(d)}`);
}
