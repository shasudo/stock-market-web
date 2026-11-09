import axios from "axios";
import apiClient, {
  getAxiosErrorMessage,
  isRecord,
  isSuccessfulApiResponse,
} from "@/lib/api-client";
import type {
  SavedViewPayload,
  SavedViewScope,
} from "@/lib/validations/saved-views";

export interface SavedView {
  readonly id: string;
  readonly name: string;
  readonly payload: SavedViewPayload;
}

const ENDPOINT = "/api/saved-views";
const LOAD_FAILED = "Saved views could not be loaded.";
const SAVE_FAILED = "The view could not be saved.";
const DELETE_FAILED = "The view could not be deleted.";

export class SavedViewsError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SavedViewsError";
  }
}

export async function fetchSavedViews(
  scope: SavedViewScope,
  signal?: AbortSignal,
): Promise<readonly SavedView[]> {
  try {
    const response = await apiClient.get<unknown>(ENDPOINT, {
      params: { scope },
      signal,
    });
    const body: unknown = response.data;
    if (!isSuccessfulApiResponse(body) || !isRecord(body.data)) {
      throw new SavedViewsError(LOAD_FAILED);
    }

    const views = body.data.views;
    return Array.isArray(views) ? views.filter(isSavedView) : [];
  } catch (error) {
    throw toSavedViewsError(error, LOAD_FAILED);
  }
}

export async function saveSavedView(input: {
  readonly name: string;
  readonly scope: SavedViewScope;
  readonly payload: SavedViewPayload;
}): Promise<void> {
  try {
    await apiClient.post<unknown>(ENDPOINT, input);
  } catch (error) {
    throw toSavedViewsError(error, SAVE_FAILED);
  }
}

export async function deleteSavedView(id: string): Promise<void> {
  try {
    await apiClient.delete<unknown>(ENDPOINT, { data: { id } });
  } catch (error) {
    throw toSavedViewsError(error, DELETE_FAILED);
  }
}

// The payload is Json in the database, so anything older than the current
// shape is dropped rather than applied half-formed.
function isSavedView(value: unknown): value is SavedView {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isRecord(value.payload) &&
    isRecord(value.payload.filters) &&
    Array.isArray(value.payload.hiddenColumns)
  );
}

// The market page renders for signed-out visitors too, so a 401 here is an
// ordinary state, not a failure — say what to do about it.
export const SIGNED_OUT_MESSAGE = "Sign in to save and reuse views.";

export function isSignedOutError(error: unknown): boolean {
  return error instanceof SavedViewsError && error.message === SIGNED_OUT_MESSAGE;
}

function toSavedViewsError(error: unknown, fallback: string): SavedViewsError {
  if (error instanceof SavedViewsError) {
    return error;
  }
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    return new SavedViewsError(SIGNED_OUT_MESSAGE);
  }
  return new SavedViewsError(getAxiosErrorMessage(error, fallback));
}
