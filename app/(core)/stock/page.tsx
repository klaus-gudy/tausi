import { redirect } from "next/navigation";

// "Stock in & out" was split into the Inventory pages; old links land on the
// matching one. This folder keeps the stock actions and dialogs they share.
export default async function StockPage({ searchParams }: PageProps<"/stock">) {
  const { tab } = await searchParams;
  redirect(tab === "movements" ? "/movement-history" : "/stock-on-hand");
}
