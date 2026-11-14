import { apiClient } from "../lib/api-client";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponseData {
  success: boolean;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  login: async (payload: LoginPayload) => {
    const res = await apiClient.post<LoginResponseData>("/auth/login", payload);
    
    if (res.data?.accessToken) {
      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("refreshToken", res.data.refreshToken);
      
      try {
        const payloadBase64 = res.data.accessToken.split('.')[1];
        const decodedJson = atob(payloadBase64);
        const tokenData = JSON.parse(decodedJson);
        
        const userDataForUI = {
          id: tokenData.id,
          name: tokenData.name || tokenData.nama || "Admin Rental",
          role: tokenData.role ? tokenData.role.toUpperCase() : "ADMIN",
          email: payload.email
        };

        localStorage.setItem("user-data", JSON.stringify(userDataForUI));
      } catch (e) {
        console.error("Gagal mendecode token atau menyimpan user data", e);
        localStorage.setItem("user-data", JSON.stringify({
          name: "Admin",
          role: "ADMIN",
          email: payload.email
        }));
      }
    }
    
    return res.data;
  },

  logout: async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch (error) {
      console.error("Logout API gagal", error);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user-data");
    }
  },

  isAuthenticated: () => {
    return !!localStorage.getItem("accessToken");
  }
};