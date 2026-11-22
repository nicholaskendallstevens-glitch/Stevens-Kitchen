"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RecipeEditor, EMPTY_DRAFT } from "@/components/RecipeEditor";
import { createRecipe, getSettings } from "@/lib/db";
import { Header, Loading, Page } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";
import type { RecipeDraft } from "@/lib/types";

export default function NewRecipePage() {
  const router = useRouter();
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  useEffect(() => {
    getSettings()
      .then((s) => setDraft(EMPTY_DRAFT(s.default_servings)))
      .catch(() => setDraft(EMPTY_DRAFT()));
  }, []);
  return (
    <Page tabbar={false}>
      <Header
        left={
          <Link href="/recipes" className="mb-1 inline-flex items-center text-sm text-herb">
            <IconChevronLeft size={16} /> Recipes
          </Link>
        }
        title="New recipe"
      />
      {!draft ? (
        <Loading />
      ) : (
        <RecipeEditor
          initial={draft}
          onCancel={() => router.back()}
          onSave={async (d) => {
            const r = await createRecipe(d);
            router.replace(`/recipes/${r.id}`);
          }}
        />
      )}
    </Page>
  );
}
