from datetime import datetime
from typing import Optional, List
from sqlalchemy import func, String, Column
from sqlalchemy.sql.elements import BinaryExpression


class DateSearchHelper:
    @staticmethod
    def parse_date(search_query: str) -> Optional[datetime.date]:
        if not search_query:
            return None
        
        search_clean = search_query.strip()
        date_formats = [
            "%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%d-%m-%Y", 
            "%d.%m.%Y", "%Y.%m.%d", "%Y-%m", "%Y/%m", 
            "%m/%Y", "%m-%Y"
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(search_clean, fmt).date()
            except ValueError:
                continue
        
        return None
    
    @staticmethod
    def build_date_search_conditions(date_column: Column, search_query: str) -> List[BinaryExpression]:
        like = f"%{search_query.strip()}%"
        
        conditions = [
            func.cast(date_column, String).ilike(like),
            func.to_char(date_column, 'DD/MM/YYYY').ilike(like),
            func.to_char(date_column, 'DD-MM-YYYY').ilike(like),
            func.to_char(date_column, 'D/M/YYYY').ilike(like),
            func.to_char(date_column, 'D-M-YYYY').ilike(like),
            func.to_char(date_column, 'DD/MM/YY').ilike(like),
            func.to_char(date_column, 'DD-MM-YY').ilike(like),
            func.to_char(date_column, 'YYYY-MM-DD').ilike(like),
            func.to_char(date_column, 'YYYY/MM/DD').ilike(like),
            func.to_char(date_column, 'YYYY-MM-D').ilike(like),
            func.to_char(date_column, 'YYYY-M-DD').ilike(like),
            func.to_char(date_column, 'YYYY-M-D').ilike(like),
            func.regexp_replace(func.cast(date_column, String), '-0([0-9])', '-\\1', 'g').ilike(like),
            func.regexp_replace(func.to_char(date_column, 'DD/MM/YYYY'), '/0([0-9])', '/\\1', 'g').ilike(like),
            func.regexp_replace(func.to_char(date_column, 'DD-MM-YYYY'), '-0([0-9])', '-\\1', 'g').ilike(like),
        ]
        
        return conditions

