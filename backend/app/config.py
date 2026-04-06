import os
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq
from supabase import create_client
from twilio.rest import Client as TwilioClient

load_dotenv()

groq = Groq(api_key=os.getenv("GROQ_API_KEY"))
supabase  = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

twilio_sid   = os.getenv("TWILIO_ACCOUNT_SID")
twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio = TwilioClient(twilio_sid, twilio_token) if twilio_sid and twilio_token else None