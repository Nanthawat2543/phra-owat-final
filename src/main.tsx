import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import Search from './pages/Search'
import FullText from './pages/FullText'
import Login from './pages/Login'

const router = createHashRouter([
  { path: '/', element: <Home /> },
  { path: '/search', element: <Search /> },
  { path: '/full', element: <FullText /> },
  { path: '/login', element: <Login /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
