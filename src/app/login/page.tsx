import AuthPanels from "./auth-panels";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; signed_out?: string }>;
}) {
  const { error, next, signed_out } = await searchParams;

  return (
    <AuthPanels initialMode="login" loginError={error} next={next} signedOut={signed_out === "1"} />
  );
}
