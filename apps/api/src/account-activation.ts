export type AccountActivationState = {
  activationTokenHash: string | null;
  activatedAt: Date | null;
};

export function requiresActivation(
  account: AccountActivationState | null,
) {
  return (
    account === null ||
    (account.activationTokenHash !== null && account.activatedAt === null)
  );
}

export const canSignIn = (account: AccountActivationState) =>
  !requiresActivation(account);
