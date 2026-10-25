"""A reproducible operational report from the same financial ledger as analytics."""
from datetime import timedelta
from sqlalchemy import func
from services.clinic_finance import analytics_sales, analytics_payments, outstanding_at
from services.clinic_catalog import scoped_query
from models import Client, Appointment


def generate(db, authority, definition):
    start, end = definition.start_date, definition.end_date
    days = (end - start).days + 1
    previous_start, previous_end = start - timedelta(days=days), start - timedelta(days=1)
    company = authority.company_id or authority.user.company_id
    # Every currency has its own metrics and time series.
    from services.clinic_finance import invoice_ledger
    from models import BillingPayment
    ledger = invoice_ledger(authority.clinic_id, company)
    currencies = {r[0] for r in db.query(ledger.c.currency).distinct() if r[0]}
    currencies.update(r[0] for r in db.query(BillingPayment.currency).join(ledger, ledger.c.id == BillingPayment.billing_id).distinct() if r[0])
    rows, charts, metrics = [], [], []
    for currency in sorted(currencies):
        sold = analytics_sales(db, company, end, previous_start, authority.clinic_id, currency)
        payments = analytics_payments(db, company, end, previous_start, authority.clinic_id, currency)
        def totals(first, last):
            values = [r for r in sold if first <= r['date'] <= last]
            amount, count = sum(r['amount'] for r in values), sum(r['orders'] for r in values)
            return {'sales': amount, 'collected': sum(r['amount'] for r in payments if first <= r['date'] <= last),
                'billed_orders': count, 'average_order_value': amount / count if count else None,
                'outstanding': outstanding_at(db, authority.clinic_id, last, currency, company)}
        current, previous = totals(start, end), totals(previous_start, previous_end)
        for key, value in current.items():
            before = previous[key]
            delta = (value - before) / abs(before) * 100 if before and value is not None else None
            metrics.append({'key': key, 'currency': currency, 'current': value, 'previous': before if definition.comparison else None,
                'change_percent': delta if definition.comparison else None})
        series = []
        day = start
        while day <= end:
            last = min(day + timedelta(days=6), end)
            values = totals(day, last)
            row = {'week': day.isoformat(), 'currency': currency, 'sales': values['sales'], 'collected': values['collected'], 'billed_orders': values['billed_orders']}
            series.append(row); rows.append(row)
            day += timedelta(days=7)
        charts.append({'kind': 'line', 'x': 'week', 'series': ['sales', 'collected'], 'currency': currency, 'rows': series})
    for key, dataset, field in [('new_patients', 'clients', Client.file_creation_date), ('appointments', 'appointments', Appointment.date)]:
        query = scoped_query(db, authority, dataset)
        current = query.filter(field >= start, field <= end).count()
        previous = query.filter(field >= previous_start, field <= previous_end).count()
        metrics.append({'key': key, 'currency': None, 'current': current, 'previous': previous if definition.comparison else None,
            'change_percent': ((current - previous) / previous * 100 if previous else None) if definition.comparison else None})
    return {'columns': ['week', 'currency', 'sales', 'collected', 'billed_orders'], 'rows': rows, 'metrics': metrics, 'charts': charts,
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'previous_start': previous_start.isoformat(), 'previous_end': previous_end.isoformat()},
        'definitions': {'sales': 'Invoice totals after discount, by order date; each invoice counted once.',
            'collected': 'Signed payment ledger amounts by payment date, including refunds.',
            'outstanding': 'Positive invoice balances at the period end; undated legacy cumulative payments use their recorded value.',
            'billed_orders': 'Distinct billed invoices; shared-order groups count once.',
            'average_order_value': 'Sales divided by billed invoice count.',
            'new_patients': 'Patient file creation dates within the period.', 'appointments': 'Recorded appointments within the period.'},
        'limitations': ['Profitability requires historical costs and expenses.', 'Undated legacy payments cannot be attributed to a payment period.',
            'Appointment records do not establish attendance.', 'Records without relevant dates do not enter dated metrics.']}
