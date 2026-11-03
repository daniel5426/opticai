"""Read-only, field-level pilot reconciliation. Keep its output clinic-private."""
from __future__ import annotations
from collections import Counter
from sqlalchemy import inspect
from sqlalchemy.orm import load_only
from hashlib import sha256
import json
from models import Client, OpticalExam, ExamLayoutInstance, MedicalLog, Order, ContactLensOrder, OrderGroup, Billing, MigrationSourceLink
from .bundle import iter_rows, source_id
from .clinical import TECHNICAL_FIELDS, CLIENT_TECHNICAL, populated, order_business_field, CLINICAL_TABLES, clinical_source_key
from .mapping import client_payload, date_value, json_value, exam_payload, clean

CLIENT_COLUMNS = dict(zip(
    'pname fname zehut bdate min kupa address city mikud sel tel telw fax email cdate qmikzoa remark'.split(),
    'first_name last_name national_id date_of_birth gender health_fund address_street address_city postal_code phone_mobile phone_home phone_work fax email file_creation_date occupation notes'.split()))
MODELS={m.__name__:m for m in [Client,OpticalExam,ExamLayoutInstance,MedicalLog,Order,ContactLensOrder,OrderGroup]}


def compare_pilot(db, *, root, validation, dataset, clinic_id, read_only_older_schema=False):
    links=db.query(MigrationSourceLink).filter(MigrationSourceLink.source_system=='opticplus',MigrationSourceLink.clinic_id==clinic_id,
        MigrationSourceLink.raw_row_ref.like(f'opticplus:{dataset}:%')).all()
    index={(link.target_model,link.raw_row_ref):link for link in links}
    targets={}
    actual_columns={}
    def get(model,ref):
        link=index.get((model,ref))
        if not link:return None
        identity=(model,link.target_id)
        if identity not in targets:
            mapped=MODELS[model]
            options=[]
            if read_only_older_schema:
                # Reconciliation can read an older schema, but cannot make the application compatible.
                if model not in actual_columns:
                    actual_columns[model]={column['name'] for column in inspect(db.get_bind()).get_columns(mapped.__tablename__)}
                options=[load_only(*(getattr(mapped,name) for name in mapped.__table__.columns.keys() if name in actual_columns[model]))]
            targets[identity]=db.get(mapped,link.target_id,options=options)
            target=targets[identity]
            if target is not None and hasattr(mapped,'clinic_id') and target.clinic_id!=clinic_id:
                raise ValueError('Comparison source link points outside target clinic')
        return targets[identity]
    def ref(table,key,suffix=''):
        return f'opticplus:{dataset}:{table}:{key}'+(':'+suffix if suffix else '')
    result=[]
    for table in ['cust_list','checks','adchecks','tb_comp','tb_gnrl_tests','tb_quest','person_remarks','orders']:
        descriptor=validation['tables'].get(table)
        if not descriptor:continue
        occurrences=Counter()
        for row in iter_rows(root,descriptor):
            key_field={'cust_list':'numw','checks':'bdikanum','adchecks':'bdikanum','orders':'rnum','tb_comp':'rnum','tb_gnrl_tests':'rnum','tb_quest':'rnum'}.get(table)
            if table in CLINICAL_TABLES:
                legacy = {str((link.source_primary_key_parts or {}).get('key')) for link in links if link.source_table==table
                          and str(link.source_per_id)==str(row.get('wnum')) and
                          str((link.raw_payload or {}).get('rnum'))==str(row.get('rnum'))}
                key=sorted(legacy,key=lambda value: (':' in value,value))[0] if legacy else clinical_source_key(row)
            elif key_field:key=source_id(row[key_field])
            else:
                digest=sha256(json.dumps(row,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
                occurrences[digest]+=1;key=f'{digest}:{occurrences[digest]}'
            model='Client' if table=='cust_list' else 'OpticalExam' if table in {'checks','adchecks'} else 'MedicalLog' if table=='person_remarks' else None
            target=get(model,ref(table,key)) if model else None
            exam=target if model=='OpticalExam' else get('OpticalExam',ref(table,key,'assessment'))
            cards=[]
            if exam:
                for instance in db.query(ExamLayoutInstance).filter_by(exam_id=exam.id):
                    cards.extend((instance.id,name,value) for name,value in (instance.exam_data or {}).items() if isinstance(value,dict))
            # User-added layouts may contain empty copies of standard cards.
            # Compare against the source-bound instance before those unrelated copies.
            imported_instances = {link.target_id for link in links
                                  if link.target_model == 'ExamLayoutInstance'
                                  and link.source_table == table
                                  and str((link.source_primary_key_parts or {}).get('key')) == key}
            cards.sort(key=lambda card: card[0] not in imported_instances)
            order_targets=[get(name,ref(table,key,kind)) for name,kind in [('Order','regular'),('ContactLensOrder','contact')]] if table=='orders' else []
            for field,original in row.items():
                if field.startswith('__') or not populated(original):continue
                current=None;expected=original;destination=None
                for instance_id,name,value in cards:
                    source=value.get('opticplus_source') or {}
                    if source.get('table')==table and str(source.get('key'))==key and field in source.get('fields',{}):
                        attribute=source['fields'][field]
                        current=value.get(attribute)
                        expected=float(original) if isinstance(current,(int,float)) and not isinstance(current,bool) else str(original)
                        destination=f'Exam {exam.id} / {name} / {attribute}'
                        break
                    if value.get('source_table')==table and str(value.get('source_key'))==key and field in value:
                        current=value[field];destination=f'Exam {exam.id} / {name} / {field}'
                        binding=(value.get('bindings') or {}).get(field)
                        if binding:
                            _,mapped=exam_payload(table,row)
                            expected=(mapped.get(binding['component']) or {}).get(binding['field'],original)
                            for _,native_name,native_value in cards:
                                if native_name==binding['component'] or native_name.startswith(binding['component']+'-'):
                                    current=native_value.get(binding['field']);break
                        break
                if table=='cust_list' and field in CLIENT_COLUMNS and target:
                    attribute=CLIENT_COLUMNS[field];expected=json_value(client_payload(row)[attribute])
                    current=json_value(getattr(target,attribute));destination=f'Client {target.id} / {attribute}'
                if table in {'checks','adchecks'} and target and destination is None:
                    contact=table=='adchecks';_,native=exam_payload(table,row)
                    source_mapping={}
                    for side in ['r','l']:
                        prefix=f'cn{side}' if contact else f'c{side}'
                        pairs=[('sph','sph'),('cyl','cyl'),('axis','ax'),('visus','va')]+(
                            [('bc','bc'),('ktr','diam'),('add','read_ad')] if contact else
                            [('add','ad'),('pd','pd_far'),('high','high'),('pris','pris'),('prist','base')])
                        source_mapping.update({prefix+suffix:f'{side}_{attribute}' for suffix,attribute in pairs})
                        if not contact:source_mapping[f'nc{side}pd']=f'{side}_pd_close'
                    source_mapping.update({'pd':'comb_pd_far','npd':'comb_pd_close'})
                    if field in source_mapping:
                        attribute=source_mapping[field]
                        for component,values in native.items():
                            if component.startswith(('notes-','opticplus-')) or attribute not in values:continue
                            expected=values[attribute]
                            for instance_id,name,value in cards:
                                if name==component or name.startswith(component+'-'):
                                    current=value.get(attribute);destination=f'Exam {exam.id} / {component} / {attribute}';break
                    elif field in {'chdate','caddate'}:
                        current=json_value(target.exam_date);expected=json_value(date_value(original,past_only=True));destination=f'Exam {target.id} / exam_date'
                    elif field=='qdomin':
                        expected={'ימין':'R','שמאל':'L'}.get(clean(original));current=target.dominant_eye;destination=f'Exam {target.id} / dominant_eye'
                    elif field=='remark':
                        expected=clean(original)
                        for instance_id,name,value in cards:
                            if name.startswith('notes-'):current=value.get('note');destination=f'Exam {target.id} / notes';break
                if table=='person_remarks' and target and field in {'teur','datew'}:
                    expected=clean(original) if field=='teur' else json_value(date_value(original))
                    current=target.log if field=='teur' else json_value(target.log_date)
                    destination=f'Medical history {target.id} / '+('log' if field=='teur' else 'log_date')
                if table=='orders' and order_business_field(field):
                    if field in {'gf_price','tpay','gpay'}:
                        group=get('OrderGroup',ref(table,key,'group'))
                        bill=db.query(Billing).filter_by(order_group_id=group.id).one() if group else None
                        if bill:
                            current={'gf_price':bill.total_after_discount,'tpay':bill.prepayment_amount,'gpay':bill.total_after_discount-(bill.prepayment_amount or 0)}[field]
                            expected=float(original);destination=f'Billing {bill.id} / {field}'
                    else:
                        for order in order_targets:
                            if not order:continue
                            source=(order.order_data or {}).get('opticplus_source') or {}
                            for section in ['context','extras']:
                                if field in source.get(section,{}):current=source[section][field];destination=f'Order {order.id} / {section} / {field}'
                            for slot in source.get('slots',[]):
                                suffix='' if slot['slot']=='1' else '2'
                                for source_field,value in slot['values'].items():
                                    if field==source_field+suffix:current=value;destination=f'Order {order.id} / slot {slot["slot"]} / {source_field}'
                status='match' if destination and current==expected else 'mismatch' if destination else 'source_evidence'
                if destination and expected is None and original is not None:
                    status='source_evidence'  # Invalid dates/unknown values remain in original evidence.
                if not destination:
                    evidence=next((link for link in links if link.source_table==table and (link.source_primary_key_parts or {}).get('key')==key and isinstance(link.raw_payload,dict)),None)
                    if evidence:
                        current=evidence.raw_payload.get(field);destination=f'Source data / {table} / {key} / {field}'
                        status='technical_provenance' if (field in TECHNICAL_FIELDS or table=='cust_list' and field in CLIENT_TECHNICAL or
                            table=='person_remarks' and field in {'sw','addw'} or table=='orders' and (not order_business_field(field) or field=='number' or
                            field.endswith('2') and original in (False,0,'0'))) else 'source_evidence'
                        if current!=original:status='mismatch'
                    else:status='missing'
                result.append({'table':table,'source_key':key,'field':field,'source_value':original,'destination':destination,
                               'displayed_value':current,'status':status})
    return result
