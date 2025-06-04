// utils/auth.js
export const getAccessToken = (session) => {
  return (
    session?.accessToken ||
    session?.user?.accessToken ||
    session?.token ||
    session?.user?.token ||
    null
  );
};
