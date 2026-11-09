import type {
  IPortfolio,
  IWatchlist,
  IWatchlistStock,
  INote,
  UserPublic,
  StockStats,
  Stock,
} from "./index";

export interface ApiSuccessResponse<T = unknown> {
  readonly success: true;
  readonly message?: string;
  readonly data: T;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly message: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  // Java sessions carry id + username only; email stays optional so the
  // guard below accepts both the legacy and the Java shape.
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginResponse {
  success: true;
  message: string;
  accessToken: string;
  user: AuthenticatedUser;
}

export interface RefreshSessionResponse {
  success: true;
  accessToken: string;
  user: AuthenticatedUser;
}

export interface LogoutResponse {
  success: true;
  message: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface RegisterResponse {
  success: true;
  message?: string;
  data: { id: string; username: string; email?: string };
}

export function isAuthenticatedUser(
  value: unknown,
): value is AuthenticatedUser {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.username) &&
    (value.email === undefined || typeof value.email === "string") &&
    (value.firstName === undefined || typeof value.firstName === "string") &&
    (value.lastName === undefined || typeof value.lastName === "string")
  );
}

export function isLoginResponse(value: unknown): value is LoginResponse {
  return (
    isRecord(value) &&
    value.success === true &&
    isNonEmptyString(value.message) &&
    isNonEmptyString(value.accessToken) &&
    isAuthenticatedUser(value.user)
  );
}

export function isRefreshSessionResponse(
  value: unknown,
): value is RefreshSessionResponse {
  return (
    isRecord(value) &&
    value.success === true &&
    isNonEmptyString(value.accessToken) &&
    isAuthenticatedUser(value.user)
  );
}

export function isRegisterResponse(value: unknown): value is RegisterResponse {
  if (!isRecord(value) || value.success !== true) {
    return false;
  }
  // Legacy shape: {success, message?, data: {id, username, email}}.
  if (
    isRecord(value.data) &&
    isNonEmptyString(value.data.id) &&
    isNonEmptyString(value.data.username) &&
    isNonEmptyString(value.data.email)
  ) {
    return true;
  }
  // Java shape: {success, message, data: {user: {id, username}, accessToken}}.
  return (
    isRecord(value.data) &&
    isRecord(value.data.user) &&
    isNonEmptyString(value.data.user.id) &&
    isNonEmptyString(value.data.user.username)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export interface GetPortfolioRequest {
  marketCondition: string;
}

export type GetPortfolioResponse = ApiSuccessResponse<{
  readonly portfolio: IPortfolio | null;
}>;

export interface UpdatePortfolioRequest {
  marketCondition: string;
  strategies: IPortfolio["strategies"];
}

export type UpdatePortfolioResponse = ApiSuccessResponse<{
  readonly portfolio: IPortfolio;
}>;

export type GetWatchlistResponse = ApiSuccessResponse<{
  readonly watchlist: IWatchlist;
}>;

export interface AddStockRequest {
  stock: Omit<IWatchlistStock, "id" | "addedAt">;
}

export type AddStockResponse = ApiSuccessResponse<{
  readonly watchlist: IWatchlist;
}>;

export interface RemoveStockRequest {
  stockId: string;
}

export type RemoveStockResponse = ApiSuccessResponse<{
  readonly watchlist: IWatchlist;
}>;

export type GetNotesResponse = ApiSuccessResponse<{
  readonly notes: INote[];
}>;

export interface CreateNoteRequest {
  title: string;
  content?: string;
  color?: INote["color"];
  tags?: string[];
}

export type CreateNoteResponse = ApiSuccessResponse<{
  readonly note: INote;
}>;

export interface UpdateNoteRequest {
  id: string;
  title?: string;
  content?: string;
  color?: INote["color"];
  isPinned?: boolean;
  tags?: string[];
}

export type UpdateNoteResponse = ApiSuccessResponse<{
  readonly note: INote;
}>;

export interface DeleteNoteRequest {
  id: string;
}

export type DeleteNoteResponse = ApiSuccessResponse<null>;

export interface GetStatsResponse {
  success: true;
  stats: StockStats;
}

export interface GetGainersResponse {
  success: true;
  message: string;
  count: number;
  data: Stock[];
}

export interface GetLosersResponse {
  success: true;
  message: string;
  count: number;
  data: Stock[];
}
