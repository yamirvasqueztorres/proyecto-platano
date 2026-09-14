"""Portable PDF reports without native GTK/Pango dependencies."""

from datetime import date, datetime
from functools import lru_cache
from html import escape
from io import BytesIO
import os
from pathlib import Path
from typing import Sequence

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Spacer, TableStyle

from .models import CorrectiveAction, NonConformity, QualityRecord
from .module_catalog import MODULES


@lru_cache
def report_fonts() -> tuple[str, str]:
    windows_fonts = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    candidates = [
        (windows_fonts / "arial.ttf", windows_fonts / "arialbd.ttf"),
        (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")),
    ]
    for regular, bold in candidates:
        if regular.is_file() and bold.is_file():
            pdfmetrics.registerFont(TTFont("CalidadReport", str(regular)))
            pdfmetrics.registerFont(TTFont("CalidadReportBold", str(bold)))
            return "CalidadReport", "CalidadReportBold"
    # Standard PDF fonts support Spanish characters and require no OS fonts.
    return "Helvetica", "Helvetica-Bold"


def render_quality_pdf(
    rows: Sequence[QualityRecord],
    nonconformities: Sequence[NonConformity],
    actions: Sequence[CorrectiveAction],
    generated_at: datetime,
) -> bytes:
    regular, bold = report_fonts()
    ink = colors.HexColor("#17352c")
    green = colors.HexColor("#14795f")
    body_style = ParagraphStyle("ReportBody", fontName=regular, fontSize=8, leading=11, textColor=ink)
    header_style = ParagraphStyle("ReportHeader", parent=body_style, fontName=bold, textColor=colors.white)
    heading_style = ParagraphStyle("ReportHeading", parent=body_style, fontName=bold, fontSize=12, leading=16, spaceBefore=15, spaceAfter=8, keepWithNext=True)
    title_style = ParagraphStyle("ReportTitle", parent=heading_style, fontSize=18, leading=22, spaceBefore=0)

    def paragraph(value: object, style: ParagraphStyle = body_style) -> Paragraph:
        # User values are text; they must never become ReportLab markup or links.
        text = "—" if value is None else str(value)
        return Paragraph(escape(text).replace("\n", "<br/>"), style)

    output = BytesIO()
    document = SimpleDocTemplate(
        output, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title="Reporte integral de calidad · Plátano verde", author="Calidad 360",
    )
    valid = [item.conformity_percent for item in rows if item.conformity_percent is not None]
    average = round(sum(valid) / len(valid), 2) if valid else 0
    active_nc = sum(item.status != "Cerrada" for item in nonconformities)
    overdue = sum(item.status != "Completada" and item.due_date < date.today() for item in actions)
    story = [
        paragraph("Reporte integral de calidad · Plátano verde", title_style),
        paragraph(f"Generado el {generated_at:%d/%m/%Y %H:%M UTC}"),
        Spacer(1, 10),
        paragraph(f"{len(rows)} registros   |   {average}% conformidad promedio   |   {active_nc} NC abiertas   |   {overdue} acciones vencidas"),
    ]

    def table_section(title: str, headers: list[str], values: list[list[object]], widths: list[float]) -> None:
        story.append(paragraph(title, heading_style))
        if not values:
            story.append(paragraph("Sin registros."))
            return
        data = [[paragraph(value, header_style) for value in headers]]
        data.extend([paragraph(value) for value in row] for row in values)
        table = LongTable(data, colWidths=[document.width * width for width in widths], repeatRows=1, hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), green),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f7f4")]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dce7e3")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(table)

    table_section("Registros de calidad", ["Código", "Módulo", "Fecha", "Estado", "Conformidad"], [
        [item.record_code, MODULES.get(item.module_code, {}).get("name", item.module_code), f"{item.created_at:%d/%m/%Y %H:%M}", item.status.value, item.conformity_percent]
        for item in rows
    ], [.19, .27, .19, .16, .19])
    table_section("No conformidades", ["Código", "Categoría", "Severidad", "Estado", "Lote"], [
        [item.code, item.category, item.severity, item.status, item.lot_code]
        for item in nonconformities
    ], [.19, .27, .16, .19, .19])
    table_section("Acciones correctivas PHVA", ["Código", "Acción", "Responsable", "Vencimiento", "Estado"], [
        [item.code, item.title, item.responsible.full_name, f"{item.due_date:%d/%m/%Y}", item.status]
        for item in actions
    ], [.18, .28, .21, .17, .16])

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(regular, 8)
        canvas.setFillColor(ink)
        canvas.drawString(document.leftMargin, 10 * mm, "Calidad 360")
        canvas.drawRightString(A4[0] - document.rightMargin, 10 * mm, f"Página {doc.page}")
        canvas.restoreState()

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
