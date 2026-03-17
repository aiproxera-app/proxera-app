import { v4 as uuidv4 } from 'uuid';

const USER_ID_KEY = 'proxera_user_id';

export function getStoredUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

export function setStoredUserId(userId: string) {
  localStorage.setItem(USER_ID_KEY, userId);
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const userId = getStoredUserId();
  const headers = {
    ...options.headers,
    'x-user-id': userId,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}
