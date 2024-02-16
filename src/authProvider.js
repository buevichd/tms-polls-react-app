import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { API_BASE_URL, axiosInstance } from "./apiConfig";

const AuthContext = createContext();

function identity(arg) {
  return arg;
}

async function handleExpiredTokenError(error) {
  if (error.response.status === 401 &&
      error.response.data.code === 'token_not_valid' &&
      error.config) {
    const originalRequest = { ...error.config };
    originalRequest._isRetry = true;
    localStorage.removeItem('token');
    if (!error.config._isRetry && localStorage.getItem('refreshToken')) {
      const body = { refresh: localStorage.getItem('refreshToken') };
      try {
        const response = await axiosInstance.post(
            `${API_BASE_URL}/api/token/refresh/`, body, originalRequest);
        if (response?.data?.access) {
          localStorage.setItem('token', response.data.access);
        }
      } catch (error) {
        originalRequest._isInvalidRefreshToken = true;
        console.log(`Refresh token error: ${error}`);
      }
      return axiosInstance.request(originalRequest);
    } else if (error.config._isInvalidRefreshToken) {
      localStorage.removeItem('refreshToken');
      return axiosInstance.request(originalRequest);
    }
  }
  throw error;
}

axiosInstance.interceptors.response.use(identity, handleExpiredTokenError);

export const AuthProvider = ({ children }) => {
  const [token, setToken_] = useState(localStorage.getItem('token'));
  const [refreshToken, setRefreshToken_] = useState(localStorage.getItem('refreshToken'));

  const setToken = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken_(newToken);
  };

  const setRefreshToken = (newRefreshToken) => {
    localStorage.setItem('refreshToken', newRefreshToken);
    setRefreshToken_(newRefreshToken);
  }

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token')
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }
  }, [token, refreshToken]);

  const contextValue = useMemo(
      () => ({
        token,
        setToken,
        refreshToken,
        setRefreshToken,
      }),
      [token, refreshToken]
  );

  return (
      <AuthContext.Provider value={contextValue}>
        {children}
      </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};

