"""Stable transactional-billing keys, independent of campaign entitlements."""
COPY = {
    "en": {"payment_received": "Payment received", "payment_failed": "Payment needs attention",
           "received": "Your payment was received.", "failed": "Update your card or retry the outstanding payment.", "billing": "Manage billing"},
    "he": {"payment_received": "התשלום התקבל", "payment_failed": "נדרש טיפול בתשלום",
           "received": "התשלום שלך התקבל.", "failed": "עדכנו כרטיס או נסו שוב לשלם את החיוב הפתוח.", "billing": "ניהול חיוב"},
    "fr": {"payment_received": "Paiement reçu", "payment_failed": "Paiement à vérifier",
           "received": "Votre paiement a été reçu.", "failed": "Mettez à jour votre carte ou réessayez le paiement en attente.", "billing": "Gérer la facturation"},
}
