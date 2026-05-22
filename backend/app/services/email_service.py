"""Resend ile transaktif e-posta gönderimi.

İki public fonksiyon var:
  - send_verification_email(user, token): kayıt anında doğrulama linki
  - send_welcome_email(user): doğrulama başarıyla bittikten sonra hoş geldin

Tasarım notları:
- Tüm gönderimler `asyncio.to_thread` ile sync Resend SDK'sını event loop'u
  bloklamadan çağırır (Resend Python SDK 0.7.x synchronous).
- API key boşsa veya gönderim hata verirse → log'a yaz, akışı kıRMA.
  Kullanıcı kaydı/doğrulaması e-posta gönderimine bağlı kalmaz; mail tekrar
  gönderilebilir endpoint'i sonradan eklenebilir.
- HTML template'leri inline-style (Outlook/Gmail uyumlu), gold/charcoal
  premium palet ile Miyaris kurumsal kimliğine yakın.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.core.config import get_settings
from app.models.user import User

logger = logging.getLogger(__name__)


def _resend_client() -> Any | None:
    """Resend SDK'yı lazy import et — paket eksikse veya API key boşsa None."""
    settings = get_settings()
    if not settings.RESEND_API_KEY:
        logger.warning(
            "[email_service] RESEND_API_KEY boş — e-posta gönderimi atlanacak"
        )
        return None
    try:
        import resend  # type: ignore
    except ImportError:
        logger.exception("[email_service] 'resend' paketi yüklü değil")
        return None
    resend.api_key = settings.RESEND_API_KEY
    return resend


async def _send(payload: dict[str, Any]) -> None:
    """Resend.Emails.send'i thread'e at — sync SDK'yı async path'te bloklamadan."""
    resend = _resend_client()
    if resend is None:
        logger.info("[email_service] Atlandı (no client) → %s", payload.get("to"))
        return

    def _do_send() -> Any:
        return resend.Emails.send(payload)

    try:
        result = await asyncio.to_thread(_do_send)
        logger.info(
            "[email_service] Gönderildi → %s (id=%s)",
            payload.get("to"),
            (result or {}).get("id") if isinstance(result, dict) else None,
        )
    except Exception:
        # Resend hatası kaydı/doğrulamayı bloklamasın — log'la geç
        logger.exception("[email_service] Gönderim hatası → %s", payload.get("to"))


# -------- Public API ---------------------------------------------------------


async def send_verification_email(user: User, token: str) -> None:
    """Kayıt sonrası: 24 saat geçerli doğrulama linkiyle mail at."""
    settings = get_settings()
    verify_url = f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={token}"
    display_name = (user.first_name or "").strip() or user.full_name or "Üyemiz"

    html = _verification_html(display_name=display_name, verify_url=verify_url)
    text = _verification_text(display_name=display_name, verify_url=verify_url)

    await _send(
        {
            "from": settings.EMAIL_FROM,
            "to": [user.email],
            "subject": "Miyaris - E-posta Adresinizi Doğrulayın",
            "html": html,
            "text": text,
        }
    )


async def send_password_reset_email(user: User, token: str) -> None:
    """Şifre sıfırlama linkini gönder.

    Token default 1 saat geçerli. Link kullanıcının frontend'ine yönlenir:
    `${FRONTEND_URL}/reset-password?token=...` — formda yeni şifre girilir,
    frontend POST /api/auth/reset-password çağırır.
    """
    settings = get_settings()
    reset_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    )
    display_name = (user.first_name or "").strip() or user.full_name or "Üyemiz"

    html = _password_reset_html(display_name=display_name, reset_url=reset_url)
    text = _password_reset_text(display_name=display_name, reset_url=reset_url)

    await _send(
        {
            "from": settings.EMAIL_FROM,
            "to": [user.email],
            "subject": "Miyaris - Şifre Sıfırlama Talebi",
            "html": html,
            "text": text,
        }
    )


async def send_welcome_email(user: User) -> None:
    """Doğrulama bittikten sonra: lüks tonlu karşılama maili."""
    settings = get_settings()
    display_name = (user.first_name or "").strip() or user.full_name or "Üyemiz"
    home_url = settings.FRONTEND_URL.rstrip("/")

    html = _welcome_html(display_name=display_name, home_url=home_url)
    text = _welcome_text(display_name=display_name, home_url=home_url)

    await _send(
        {
            "from": settings.EMAIL_FROM,
            "to": [user.email],
            "subject": "Miyaris Dünyasına Hoş Geldiniz",
            "html": html,
            "text": text,
        }
    )


# -------- HTML / Text şablonları ---------------------------------------------
# Stil paleti:
#   #0B0B0F (charcoal arka plan), #FFFFFF (kart), #1F1F23 (metin),
#   #B8A179 (Miyaris altın), #6B6B70 (ikincil metin)
# Tüm CSS inline — major mail istemcileri <style> tag'lerini stripliyor.


_BASE_WRAPPER = """\
<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>{title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0B0B0F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1F1F23;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B0B0F;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border-radius:4px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:40px 32px 24px 32px;border-bottom:1px solid #ECEAE3;">
                <div style="font-family:'Cormorant Garamond','Times New Roman',serif;font-size:28px;letter-spacing:8px;color:#1F1F23;font-weight:500;">MIYARIS</div>
                <div style="margin-top:6px;font-size:11px;letter-spacing:3px;color:#B8A179;text-transform:uppercase;">Lüks Saat Pazarı</div>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 32px;color:#1F1F23;">{body}</td>
            </tr>
            <tr>
              <td style="background-color:#F8F6F0;padding:24px 32px;text-align:center;font-size:12px;color:#6B6B70;line-height:1.6;">
                Bu e-postayı Miyaris'e kayıt olduğunuz için aldınız. Üyelik açma talebinde bulunmadıysanız bu mesajı görmezden gelebilirsiniz.<br/>
                <span style="color:#B8A179;">© Miyaris</span> · Güvenli ve Doğrulanmış Lüks Saat İşlemleri
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _verification_html(*, display_name: str, verify_url: str) -> str:
    body = f"""\
<p style="font-size:14px;letter-spacing:2px;color:#B8A179;text-transform:uppercase;margin:0 0 16px 0;">E-posta Doğrulama</p>
<h1 style="font-family:'Cormorant Garamond','Times New Roman',serif;font-size:28px;font-weight:500;color:#1F1F23;margin:0 0 24px 0;line-height:1.3;">Merhaba {display_name},</h1>
<p style="font-size:15px;line-height:1.7;color:#1F1F23;margin:0 0 16px 0;">
  Miyaris'e hoş geldiniz. Hesabınızı etkinleştirmek ve lüks saat pazarımızdaki tüm vitrinlere erişebilmek için lütfen e-posta adresinizi doğrulayın.
</p>
<p style="font-size:15px;line-height:1.7;color:#1F1F23;margin:0 0 32px 0;">
  Aşağıdaki düğmeye tıklayarak doğrulamayı tamamlayabilirsiniz. Link <strong style="color:#1F1F23;">24 saat</strong> boyunca geçerlidir.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 32px auto;">
  <tr>
    <td align="center" bgcolor="#1F1F23" style="border-radius:2px;">
      <a href="{verify_url}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:13px;letter-spacing:3px;color:#FFFFFF;text-decoration:none;text-transform:uppercase;font-weight:500;">E-postamı Doğrula</a>
    </td>
  </tr>
</table>
<p style="font-size:12px;line-height:1.7;color:#6B6B70;margin:32px 0 0 0;border-top:1px solid #ECEAE3;padding-top:24px;">
  Düğme çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza yapıştırın:<br/>
  <a href="{verify_url}" style="color:#B8A179;word-break:break-all;">{verify_url}</a>
</p>"""
    return _BASE_WRAPPER.format(title="E-posta Doğrulama", body=body)


def _verification_text(*, display_name: str, verify_url: str) -> str:
    return (
        f"Merhaba {display_name},\n\n"
        "Miyaris'e hoş geldiniz. Hesabınızı etkinleştirmek için e-posta adresinizi "
        "doğrulamanız gerekiyor.\n\n"
        f"Doğrulama linki (24 saat geçerli):\n{verify_url}\n\n"
        "— Miyaris"
    )


def _password_reset_html(*, display_name: str, reset_url: str) -> str:
    body = f"""\
<p style="font-size:14px;letter-spacing:2px;color:#B8A179;text-transform:uppercase;margin:0 0 16px 0;">Şifre Sıfırlama</p>
<h1 style="font-family:'Cormorant Garamond','Times New Roman',serif;font-size:28px;font-weight:500;color:#1F1F23;margin:0 0 24px 0;line-height:1.3;">Merhaba {display_name},</h1>
<p style="font-size:15px;line-height:1.7;color:#1F1F23;margin:0 0 16px 0;">
  Miyaris hesabınız için bir şifre sıfırlama talebi aldık. Aşağıdaki düğmeye tıklayarak yeni şifrenizi belirleyebilirsiniz.
</p>
<p style="font-size:15px;line-height:1.7;color:#1F1F23;margin:0 0 32px 0;">
  Güvenliğiniz için bu link <strong style="color:#1F1F23;">1 saat</strong> boyunca geçerlidir. Süresi dolarsa giriş sayfasındaki "Şifremi Unuttum" bağlantısından yeni bir talep oluşturabilirsiniz.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 32px auto;">
  <tr>
    <td align="center" bgcolor="#1F1F23" style="border-radius:2px;">
      <a href="{reset_url}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:13px;letter-spacing:3px;color:#FFFFFF;text-decoration:none;text-transform:uppercase;font-weight:500;">Yeni Şifre Belirle</a>
    </td>
  </tr>
</table>
<p style="font-size:13px;line-height:1.7;color:#6B6B70;margin:32px 0 16px 0;border-top:1px solid #ECEAE3;padding-top:24px;">
  Bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz. Mevcut şifreniz değişmeden kalır ve hiçbir aksiyon gerekmez.
</p>
<p style="font-size:12px;line-height:1.7;color:#6B6B70;margin:0;">
  Düğme çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza yapıştırın:<br/>
  <a href="{reset_url}" style="color:#B8A179;word-break:break-all;">{reset_url}</a>
</p>"""
    return _BASE_WRAPPER.format(title="Şifre Sıfırlama", body=body)


def _password_reset_text(*, display_name: str, reset_url: str) -> str:
    return (
        f"Merhaba {display_name},\n\n"
        "Miyaris hesabınız için bir şifre sıfırlama talebi aldık.\n"
        "Aşağıdaki linki kullanarak yeni şifrenizi belirleyebilirsiniz.\n\n"
        f"Sıfırlama linki (1 saat geçerli):\n{reset_url}\n\n"
        "Bu talebi siz yapmadıysanız bu mesajı görmezden gelebilirsiniz.\n\n"
        "— Miyaris"
    )


def _welcome_html(*, display_name: str, home_url: str) -> str:
    body = f"""\
<p style="font-size:14px;letter-spacing:2px;color:#B8A179;text-transform:uppercase;margin:0 0 16px 0;">Hoş Geldiniz</p>
<h1 style="font-family:'Cormorant Garamond','Times New Roman',serif;font-size:30px;font-weight:500;color:#1F1F23;margin:0 0 24px 0;line-height:1.3;">Miyaris Dünyasına Hoş Geldiniz, {display_name}</h1>
<p style="font-size:15px;line-height:1.7;color:#1F1F23;margin:0 0 16px 0;">
  E-postanızı başarıyla doğruladınız. Artık Miyaris'in tüm vitrinlerine, müzayedelerine ve doğrudan satış akışına tam erişiminiz var.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0;width:100%;">
  <tr>
    <td style="padding:20px 24px;background-color:#F8F6F0;border-left:3px solid #B8A179;">
      <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:2px;color:#B8A179;text-transform:uppercase;">Açık Arttırma</p>
      <p style="margin:0;font-size:14px;color:#1F1F23;line-height:1.6;">Haftalık küratörlü müzayedelerde dünyaca tanınmış saatler için teklif verin.</p>
    </td>
  </tr>
  <tr><td style="height:12px;"></td></tr>
  <tr>
    <td style="padding:20px 24px;background-color:#F8F6F0;border-left:3px solid #B8A179;">
      <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:2px;color:#B8A179;text-transform:uppercase;">Miyaris Mağaza</p>
      <p style="margin:0;font-size:14px;color:#1F1F23;line-height:1.6;">Doğrudan satışta hızlıca alın veya satışa çıkarın. Tüm işlemler ön ekspertizden geçer.</p>
    </td>
  </tr>
  <tr><td style="height:12px;"></td></tr>
  <tr>
    <td style="padding:20px 24px;background-color:#F8F6F0;border-left:3px solid #B8A179;">
      <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:2px;color:#B8A179;text-transform:uppercase;">Güvenli Kasa</p>
      <p style="margin:0;font-size:14px;color:#1F1F23;line-height:1.6;">Tüm ödemeler ekspertiz sonrası serbest kalır — alıcı için garanti, satıcı için itibar.</p>
    </td>
  </tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
  <tr>
    <td align="center" bgcolor="#1F1F23" style="border-radius:2px;">
      <a href="{home_url}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:13px;letter-spacing:3px;color:#FFFFFF;text-decoration:none;text-transform:uppercase;font-weight:500;">Vitrini Keşfet</a>
    </td>
  </tr>
</table>
<p style="font-size:13px;line-height:1.7;color:#6B6B70;margin:32px 0 0 0;font-style:italic;border-top:1px solid #ECEAE3;padding-top:24px;text-align:center;">
  Doğru saat, doğru sahibini bulur. Miyaris'te şimdi bekleyen yeni bir hikâye olabilir.
</p>"""
    return _BASE_WRAPPER.format(title="Hoş Geldiniz", body=body)


def _welcome_text(*, display_name: str, home_url: str) -> str:
    return (
        f"Miyaris dünyasına hoş geldiniz, {display_name}.\n\n"
        "E-postanız doğrulandı. Artık tüm vitrinlere, müzayedelere ve doğrudan "
        "satış akışına tam erişiminiz var.\n\n"
        f"Vitrini keşfet: {home_url}\n\n"
        "— Miyaris"
    )
