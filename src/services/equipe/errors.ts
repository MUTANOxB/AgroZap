export type TeamDomainErrorCode =
  | "PROPERTY_ACCESS_DENIED"
  | "INVALID_PHONE"
  | "USER_NOT_FOUND"
  | "USER_DEACTIVATED"
  | "ALREADY_MEMBER"
  | "MEMBER_NOT_FOUND"
  | "INVALID_ROLE"
  | "ROLE_UNCHANGED"
  | "SELF_MANAGEMENT"
  | "FORBIDDEN"
  | "LAST_OWNER"
  | "CONCURRENCY_CONFLICT";

export class TeamDomainError extends Error {
  constructor(
    public readonly code: TeamDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TeamDomainError";
  }
}
