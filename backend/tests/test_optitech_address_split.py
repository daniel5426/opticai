import pytest

from backend.migration.optitech.src import phase2, records
from backend.migration.optitech.src.records import split_street_address


@pytest.mark.parametrize(
    "address,expected",
    [
        ("נתיבות המשפט 52/1", ("נתיבות המשפט", "52/1")),
        ("רשבי  24", ("רשבי", "24")),
        ('רשב"י 4/5', ('רשב"י', "4/5")),
        ("החרמון 12 א", ("החרמון", "12א")),
        ("שדי חמד 9א", ("שדי חמד", "9א")),
        ("מקלב  18 /2", ("מקלב", "18/2")),
        ("רחוב חדש", ("רחוב חדש", None)),            # no number
        ("163", ("163", None)),                      # number without a street
        ("רבי עקיבא 52 בני ברק", ("רבי עקיבא 52 בני ברק", None)),  # text after the number
        ("ת. ד. 87", ("ת. ד. 87", None)),            # P.O. box
        ("ת.ד 412", ("ת.ד 412", None)),
        ('ת"ד 9', ('ת"ד 9', None)),
        ("יהלום 11  ת.ד 61", ("יהלום 11  ת.ד 61", None)),
        ("ד.נ. שמשון 48", ("ד.נ. שמשון 48", None)),  # rural postal route
        ("יערות דבש 22", ("יערות דבש", "22")),        # "ת ד" across words is not a P.O. box
        ("ישועת דוד 20", ("ישועת דוד", "20")),
        ("נתיבות המשפט97", ("נתיבות המשפט", "97")),   # no space before the number
        ("רשבי42/26", ("רשבי", "42/26")),
        ("רשבי 22\\10", ("רשבי", "22/10")),           # backslash as apartment separator
        ("טורי זהב 3 ב'", ("טורי זהב", "3ב")),         # entrance letter with geresh
        ("שדי חמד 9/ד", ("שדי חמד", "9/ד")),          # apartment letter
        ("שאגת אריה 15/", ("שאגת אריה 15/", None)),  # incomplete apartment
        ("משך חכמה 10 10", ("משך חכמה 10 10", None)),  # ambiguous repeated number
        ("ר עקיבא  /3 7", ("ר עקיבא  /3 7", None)),
        ("משק 60 0", ("משק 60 0", None)),
        ("רחוב 1948 5", ("רחוב 1948 5", None)),
        (None, (None, None)),
        ("", ("", None)),
    ],
)
def test_split_street_address(address, expected):
    assert split_street_address(address) == expected


def test_client_target_payload_uses_the_split():
    seed = records.normalize_client_row({"PerId": "1", "LastName": "כהן", "Address": "נתיבות המשפט 52/1 "})
    payload = phase2.client_payload_from_seed(seed, clinic_id=1, company_id=1, family_target_id=None)
    assert (payload["address_street"], payload["address_number"]) == ("נתיבות המשפט", "52/1")
