import AuthPanels from "./auth-panels";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <AuthPanels initialMode="login" loginError={error} next={next} />
  );
}
