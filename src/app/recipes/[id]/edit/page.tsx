"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RecipeEditor } from "@/components/RecipeEditor";
import { getRecipe, updateRecipe } from "@/lib/db";
import type { Recipe } from "@/lib/types";
import { Header, Loading, Page } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";

export default function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [r, setR] = useState<Recipe | null>(null);
  useEffect(() => {
    getRecipe(id).then(setR);
  }, [id]);
  return (
    <Page tabbar={false}>
      <Header
        left={
          <Link href={`/recipes/${id}`} className="mb-1 inline-flex items-center text-sm text-herb">
            <IconChevronLeft size={16} /> Recipe
          </Link>
        }
        title="Edit recipe"
      />
      {!r ? (
        <Loading />
      ) : (
        <RecipeEditor
          initial={r}
          saveLabel="Save changes"
          onCancel={() => router.back()}
          onSave={async (d) => {
            // strip DB-only fields
            const { title, description, image_url, source_url, servings, prep_minutes, cook_minutes, total_minutes, ingredients, steps, tags, notes, favorite, rating } = d;
            await updateRecipe(id, { title, description, image_url, source_url, servings, prep_minutes, cook_minutes, total_minutes, ingredients, steps, tags, notes, favorite, rating });
            router.replace(`/recipes/${id}`);
          }}
        />
      )}
    </Page>
  );
}
