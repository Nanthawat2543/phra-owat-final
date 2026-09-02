import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import Search from './pages/Search'
import FullText from './pages/FullText'
import Login from './pages/Login'
import AdminMembers from './pages/AdminMembers'
import RequireLogin from './components/RequireLogin'

const router = createHashRouter([
  { path: '/', element: <Home /> },
  // ค้นหาต้องเข้าสู่ระบบก่อน — ส่วนหน้าแรกและการเปิดรับประจำวันเปิดให้ทุกคน
  {
    path: '/search',
    element: (
      <RequireLogin>
        <Search />
      </RequireLogin>
    ),
  },
  { path: '/full', element: <FullText /> },
  { path: '/login', element: <Login /> },
  { path: '/admin', element: <AdminMembers /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
