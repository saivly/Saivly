import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addTodo, toggleTodo, deleteTodo } from "./actions";
import PasskeyManager from "./passkey-manager";

/**
 * Protected page. The proxy already redirects unauthenticated users,
 * but we defense-in-depth check again here — never rely on the proxy alone.
 * Every query below runs through RLS: users can only ever see their own rows.
 */
export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: todos }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("todos")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {profile?.full_name || "Dashboard"}
          </h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-panel">
            Sign out
          </button>
        </form>
      </header>

      <section className="rounded-xl border border-line bg-panel p-5">
        <h2 className="mb-4 text-sm font-medium tracking-wide text-muted uppercase">
          Todos (RLS demo — you only see yours)
        </h2>

        <form action={addTodo} className="mb-4 flex gap-2">
          <input
            name="task"
            required
            placeholder="Add a task"
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Add
          </button>
        </form>

        <ul className="flex flex-col gap-2">
          {(todos ?? []).map((todo) => (
            <li
              key={todo.id}
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"
            >
              <form action={toggleTodo}>
                <input type="hidden" name="id" value={todo.id} />
                <input
                  type="hidden"
                  name="done"
                  value={String(!todo.is_complete)}
                />
                <button
                  className={
                    todo.is_complete ? "text-muted line-through" : ""
                  }
                >
                  {todo.task}
                </button>
              </form>
              <form action={deleteTodo}>
                <input type="hidden" name="id" value={todo.id} />
                <button className="text-muted hover:text-danger">✕</button>
              </form>
            </li>
          ))}
          {(todos ?? []).length === 0 && (
            <li className="text-sm text-muted">
              Nothing yet. Add your first task above.
            </li>
          )}
        </ul>
      </section>

      <PasskeyManager />
    </main>
  );
}
