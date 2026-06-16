# -*- coding: utf-8 -*-
"""
AquaControll – centrální konfigurace.

⚠️ BEZPEČNOSTNÍ ZÁSADA – TESTOVACÍ PROVOZ
=========================================
Aplikace je ve fázi vývoje a testuje ji zatím jen autor. NIKOMU nesmí
chodit žádné oficiální avízo (e-mail, Web Push, SMS). Veškerý notifikační
kód, který kdy vznikne, MUSÍ nejdřív zkontrolovat `notifikace_povoleny()`.

Dokud je `TESTOVACI_REZIM = True`, žádná zpráva se ven neodešle – v nejhorším
se jen zaloguje do konzole (tzv. "dry-run").
"""

# ----------------------------------------------------------------------
# HLAVNÍ VYPÍNAČ NOTIFIKACÍ
# ----------------------------------------------------------------------

# True  = nic se reálně neodesílá (bezpečný testovací provoz)  ← VÝCHOZÍ
# False = ostrý provoz (smí se až po dokončení a vědomém zapnutí)
TESTOVACI_REZIM = True

# Druhá pojistka: i kdyby někdo přepnul TESTOVACI_REZIM, notifikace
# jsou navíc vypnuté tímto přepínačem. Pro ostrý provoz musí být obojí.
NOTIFIKACE_AKTIVNI = False

# Kam se má (v testu) směrovat veškerá pošta místo skutečných příjemců.
# Necháno prázdné = neodesílat vůbec, jen logovat.
TESTOVACI_EMAIL = ""


def notifikace_povoleny() -> bool:
    """Jediné místo, které rozhoduje, zda se SMÍ reálně odeslat notifikace.

    Vrací True pouze v ostrém provozu (testovací režim vypnutý a
    notifikace zapnuté). Veškerý odesílací kód to musí respektovat.
    """
    return (not TESTOVACI_REZIM) and NOTIFIKACE_AKTIVNI
