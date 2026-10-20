from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models


class CitizenProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="citizen_profile",
    )
    full_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    phone = models.CharField(
        max_length=20,
        validators=[
            RegexValidator(
                regex=r"^[0-9+().\-\s]{7,20}$",
                message="Enter a valid phone number.",
            )
        ],
    )

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name
