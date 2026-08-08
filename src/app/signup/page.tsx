import AuthPanels from "../login/auth-panels";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <AuthPanels initialMode="signup" signupError={error} sent={!!sent} />
  );
}
