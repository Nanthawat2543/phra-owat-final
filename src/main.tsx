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
  // ค้นหาต้องล็อกอินก่อน (สุ่มหน้าแรกยังเปิดสาธารณะ)
  {
    path: '/search',
    element: (
      <RequireLogin>
        <Search />
      </RequireLogin>
    ),
  },
  // อ่านฉบับเต็มก็ต้องล็อกอิน — หน้าสุ่มโชว์แค่ท่อนสั้น
  {
    path: '/full',
    element: (
      <RequireLogin>
        <FullText />
      </RequireLogin>
    ),
  },
  { path: '/login', element: <Login /> },
  { path: '/admin', element: <AdminMembers /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
