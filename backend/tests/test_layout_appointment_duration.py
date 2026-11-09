from EndPoints.exam_layouts import build_layout_tree
from models import ExamLayout


def test_layout_tree_returns_appointment_duration():
    group = ExamLayout(id=1, name="group", layout_data="{}", is_group=True, sort_index=0, appointment_duration=45, appointment_color="#2563eb")
    child = ExamLayout(id=2, name="child", layout_data="{}", parent_layout_id=1, sort_index=0)

    [tree] = build_layout_tree([group, child])

    assert (tree["appointment_duration"], tree["appointment_color"]) == (45, "#2563eb")
    assert tree["children"][0]["appointment_duration"] is None
