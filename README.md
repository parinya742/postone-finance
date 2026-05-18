# Postone Finance — Advanced RBAC System

## Stack
- **Backend**: Laravel 11 + Sanctum (API auth) — `backend/`
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS — `frontend/`
- **Database**: PostgreSQL

## การเริ่มต้นใช้งาน

### 1. ตั้งค่า PostgreSQL
สร้าง database ชื่อ `postone_finance` ใน PostgreSQL แล้วอัปเดต `backend/.env`:
```
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

### 2. ติดตั้ง Backend
```bash
cd backend
composer install
php artisan migrate
php artisan db:seed
php artisan serve   # รันที่ http://localhost:8000
```

### 3. ติดตั้ง Frontend
```bash
cd frontend
npm install
npm run dev         # รันที่ http://localhost:3000
```

## บัญชีผู้ใช้เริ่มต้น
| Email | Password | Role |
|-------|----------|------|
| superadmin@postone.local | password | Super Admin |
| admin@postone.local | password | Admin |
| manager@postone.local | password | Manager |

## RBAC Architecture

### Roles (ลำดับจากสูงสุด)
| Role | Level | คำอธิบาย |
|------|-------|----------|
| Super Admin | 1 | เข้าถึงทุกอย่าง |
| Admin | 2 | จัดการ users, roles, settings |
| Manager | 3 | จัดการ finance, reports |
| Staff | 4 | สร้าง/แก้ไข finance records |
| Viewer | 5 | อ่านอย่างเดียว |

### Permissions (modules × actions)
| Module | Actions |
|--------|---------|
| users | view, create, edit, delete, export |
| roles | view, create, edit, delete |
| permissions | view, create, edit, delete |
| finance | view, create, edit, delete, export, approve |
| reports | view, export |
| settings | view, edit |
| audit_logs | view, export |
| dashboard | view |

## API Endpoints
```
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/logout

GET    /api/roles
POST   /api/roles
PUT    /api/roles/{id}
DELETE /api/roles/{id}
POST   /api/roles/{id}/permissions

GET    /api/permissions
POST   /api/permissions
PUT    /api/permissions/{id}
DELETE /api/permissions/{id}

GET    /api/users
POST   /api/users
PUT    /api/users/{id}
DELETE /api/users/{id}
POST   /api/users/{id}/roles
DELETE /api/users/{id}/roles/{roleId}
```
