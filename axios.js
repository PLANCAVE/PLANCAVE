import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: 'http://localhost:5000/',  // backend API
    
});

export default axiosInstance;
