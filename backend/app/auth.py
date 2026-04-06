from fastapi import HTTPException, Header
from app.config import supabase

def get_user_id(authorization: str = Header(...)) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        user  = supabase.auth.get_user(token)
        return user.user.id
    except:
        raise HTTPException(status_code=401, detail="Invalid or expired token. Please log in again.")