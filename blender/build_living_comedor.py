import math
import os
import bpy
import bmesh
from mathutils import Vector, Euler

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLENDER_TEX_DIR = os.path.join(ROOT_DIR, "blender", "textures")
PUBLIC_TEX_DIR = os.path.join(ROOT_DIR, "public", "textures")
OUT_BLEND = os.path.join(ROOT_DIR, "blender", "living_comedor.blend")
OUT_GLB = os.path.join(ROOT_DIR, "public", "models", "living_comedor.glb")
PREVIEW_LIVING = os.path.join(ROOT_DIR, "blender", "preview_living.png")
PREVIEW_DINING = os.path.join(ROOT_DIR, "blender", "preview_dining.png")


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def get_or_create_collection(name, parent=None):
    if name in bpy.data.collections:
        return bpy.data.collections[name]
    col = bpy.data.collections.new(name)
    if parent is None:
        bpy.context.scene.collection.children.link(col)
    else:
        parent.children.link(col)
    return col


def link_obj(obj, col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def make_pbr_material(
    name,
    color=(0.8, 0.8, 0.8, 1.0),
    roughness=0.7,
    metallic=0.0,
    image_path=None,
    bump_path=None,
    bump_strength=0.15,
    uv_scale=(1.0, 1.0),
    alpha=1.0,
    emission=None,
    emission_strength=0.0,
):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (500, 0)

    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (180, 0)
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    if emission is not None and "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    if alpha < 1.0:
        mat.blend_method = "BLEND"

    tex_coord = nodes.new("ShaderNodeTexCoord")
    tex_coord.location = (-700, 0)
    mapping = nodes.new("ShaderNodeMapping")
    mapping.location = (-500, 0)
    mapping.inputs["Scale"].default_value = (uv_scale[0], uv_scale[1], 1.0)
    links.new(tex_coord.outputs["UV"], mapping.inputs["Vector"])

    if image_path and os.path.exists(image_path):
        img = bpy.data.images.load(image_path, check_existing=True)
        tex = nodes.new("ShaderNodeTexImage")
        tex.location = (-220, 140)
        tex.image = img
        links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

    if bump_path and os.path.exists(bump_path):
        bimg = bpy.data.images.load(bump_path, check_existing=True)
        bimg.colorspace_settings.name = "Non-Color"
        btex = nodes.new("ShaderNodeTexImage")
        btex.location = (-220, -160)
        btex.image = bimg
        links.new(mapping.outputs["Vector"], btex.inputs["Vector"])

        bump = nodes.new("ShaderNodeBump")
        bump.location = (0, -160)
        bump.inputs["Strength"].default_value = bump_strength
        bump.inputs["Distance"].default_value = 0.015
        links.new(btex.outputs["Color"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


def add_box(name, loc, size, mat, col, rot=(0, 0, 0), bevel_width=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel_width > 0:
        bev = obj.modifiers.new("Bevel", "BEVEL")
        bev.width = bevel_width
        bev.segments = 2
    if mat:
        obj.data.materials.append(mat)
    link_obj(obj, col)
    return obj


def add_cylinder(name, loc, radius, depth, mat, col, rot=(0, 0, 0), verts=24, smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    if smooth:
        bpy.ops.object.shade_smooth()
    if mat:
        obj.data.materials.append(mat)
    link_obj(obj, col)
    return obj


def add_plush_pillow(name, loc, size, mat, col, rot=(0, 0, 0), puff=0.04):
    w, d, h = size
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=6, use_grid_fill=True)

    for v in bm.verts:
        nx, ny, nz = v.co.x * 2.0, v.co.y * 2.0, v.co.z * 2.0
        # Rounded pillow profile + pinched seams
        radial = max(0.0, 1.0 - (nx * nx * 0.45 + ny * ny * 0.45))
        v.co.x *= w
        v.co.y *= d * (0.45 + radial * 0.85) + math.copysign(puff * radial, v.co.y)
        v.co.z *= h
        # Slight seam pinch near outer edges
        if abs(ny) > 0.85:
            v.co.y *= 0.85

    bm.to_mesh(mesh)
    bm.free()

    # Planar UV projection for pillow front/back
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for loop_idx in poly.loop_indices:
            vert = mesh.vertices[mesh.loops[loop_idx].vertex_index]
            u = (vert.co.x / w) + 0.5
            v_coord = (vert.co.z / h) + 0.5
            uv_layer.data[loop_idx].uv = (u, v_coord)

    obj.location = loc
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    for p in mesh.polygons:
        p.use_smooth = True
    link_obj(obj, col)
    return obj


def build_sofa(name_prefix, loc, rot_z, seats, fabric_mat, cushion_mats, col, throw_mat=None):
    parent = bpy.data.objects.new(name_prefix, None)
    parent.location = loc
    parent.rotation_euler = (0, 0, rot_z)
    link_obj(parent, col)

    seat_w = 1.48 if seats == 3 else 1.06
    arm_w = 0.21
    total_w = seat_w + arm_w * 2
    depth = 0.86

    # Base apron + subtle slipcover skirt folds
    base = add_box(f"{name_prefix}_Base", (0, 0, 0.14), (total_w, depth, 0.26), fabric_mat, col, bevel_width=0.03)
    base.parent = parent

    # Skirt with subtle wavy slipcover pleats
    mesh = bpy.data.meshes.new(f"{name_prefix}_Skirt_mesh")
    skirt = bpy.data.objects.new(f"{name_prefix}_Skirt", mesh)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=14, use_grid_fill=True)
    for v in bm.verts:
        v.co.x *= total_w + 0.02
        v.co.y *= depth + 0.02
        v.co.z *= 0.14
        if v.co.z < 0:
            v.co.y += math.sin(v.co.x * 20.0) * 0.009
            v.co.x += math.sin(v.co.y * 18.0) * 0.007
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    skirt.location = (0, 0, 0.07)
    skirt.data.materials.append(fabric_mat)
    link_obj(skirt, col)
    skirt.parent = parent

    # Plush rounded seat cushions
    cw = seat_w / seats - 0.012
    for i in range(seats):
        cx = -seat_w / 2 + (i + 0.5) * (seat_w / seats)
        cush = add_box(
            f"{name_prefix}_Seat_{i}",
            (cx, 0.05, 0.33),
            (cw, depth - 0.15, 0.16),
            fabric_mat,
            col,
            bevel_width=0.05,
        )
        bpy.ops.object.shade_smooth()
        cush.parent = parent

        back_cush = add_box(
            f"{name_prefix}_Back_{i}",
            (cx, -depth / 2 + 0.13, 0.58),
            (cw, 0.22, 0.46),
            fabric_mat,
            col,
            rot=(0.1, 0, 0),
            bevel_width=0.055,
        )
        bpy.ops.object.shade_smooth()
        back_cush.parent = parent

    # Rolled armrests
    for side in (-1, 1):
        ax = side * (seat_w / 2 + arm_w / 2)
        arm = add_box(
            f"{name_prefix}_Arm_{side}",
            (ax, 0.0, 0.34),
            (arm_w, depth - 0.04, 0.42),
            fabric_mat,
            col,
            bevel_width=0.04,
        )
        arm.parent = parent
        roll = add_cylinder(
            f"{name_prefix}_ArmRoll_{side}",
            (ax, 0.0, 0.54),
            arm_w / 2,
            depth - 0.05,
            fabric_mat,
            col,
            rot=(math.pi / 2, 0, 0),
        )
        roll.parent = parent

    # Decorative cushions matching photo positions
    if seats == 3:
        # Both terracotta brocade cushions on the dining-side end (left in local X -> -X)
        p1 = add_plush_pillow(
            f"{name_prefix}_Pillow_1",
            (-seat_w * 0.30, -0.14, 0.57),
            (0.42, 0.14, 0.38),
            cushion_mats[0],
            col,
            rot=(0.24, 0.06, -0.22),
        )
        p1.parent = parent
        p2 = add_plush_pillow(
            f"{name_prefix}_Pillow_2",
            (0.02, -0.15, 0.56),
            (0.40, 0.14, 0.36),
            cushion_mats[0],
            col,
            rot=(0.22, -0.05, 0.12),
        )
        p2.parent = parent
    else:
        # 2-seat sofa: terracotta + dark rose floral cushion + throw blanket on window arm
        p1 = add_plush_pillow(
            f"{name_prefix}_Pillow_1",
            (-seat_w * 0.24, -0.14, 0.56),
            (0.40, 0.14, 0.36),
            cushion_mats[0],
            col,
            rot=(0.24, 0.05, -0.2),
        )
        p1.parent = parent
        p2 = add_plush_pillow(
            f"{name_prefix}_Pillow_2",
            (seat_w * 0.22, -0.13, 0.55),
            (0.38, 0.14, 0.35),
            cushion_mats[1],
            col,
            rot=(0.26, -0.06, 0.22),
        )
        p2.parent = parent

        if throw_mat:
            # Draped black-and-white throw blanket over window-side arm (+X local)
            throw = add_box(
                f"{name_prefix}_ThrowBlanket",
                (seat_w / 2 + arm_w / 2, 0.02, 0.47),
                (0.24, 0.52, 0.32),
                throw_mat,
                col,
                bevel_width=0.045,
            )
            bpy.ops.object.shade_smooth()
            throw.parent = parent

    return parent


def build_curved_dining_chair(name, loc, rot_z, wood_mat, pad_mat, col):
    chair = bpy.data.objects.new(name, None)
    chair.location = loc
    chair.rotation_euler = (0, 0, rot_z)
    link_obj(chair, col)

    # Front tapered legs
    for lx in (-0.185, 0.185):
        leg_f = add_cylinder(f"{name}_FLeg_{lx}", (lx, 0.185, 0.22), 0.019, 0.44, wood_mat, col, verts=12)
        leg_f.parent = chair

    # Curved tall rear stiles
    for lx in (-0.19, 0.19):
        leg_b = add_cylinder(f"{name}_BLeg_{lx}", (lx, -0.20, 0.47), 0.021, 0.94, wood_mat, col, rot=(-0.06, 0, 0), verts=12)
        leg_b.parent = chair

    # Seat frame & plump upholstered beige cushion
    s_frame = add_box(f"{name}_SeatWood", (0, 0, 0.43), (0.43, 0.43, 0.042), wood_mat, col, bevel_width=0.012)
    s_frame.parent = chair
    s_pad = add_box(f"{name}_SeatPad", (0, 0.01, 0.47), (0.40, 0.40, 0.052), pad_mat, col, bevel_width=0.022)
    bpy.ops.object.shade_smooth()
    s_pad.parent = chair

    # Arched dark wood top rail & inset upholstered backrest
    top_rail = add_box(f"{name}_TopRail", (0, -0.22, 0.92), (0.43, 0.042, 0.075), wood_mat, col, rot=(-0.06, 0, 0), bevel_width=0.014)
    top_rail.parent = chair
    b_pad = add_box(f"{name}_BackPad", (0, -0.205, 0.72), (0.33, 0.038, 0.34), pad_mat, col, rot=(-0.06, 0, 0), bevel_width=0.016)
    bpy.ops.object.shade_smooth()
    b_pad.parent = chair
    return chair


def build_botanical_plant(name, loc, scale, leaf_mat, pot_mat, soil_mat, col):
    parent = bpy.data.objects.new(name, None)
    parent.location = loc
    link_obj(parent, col)

    pot = add_cylinder(f"{name}_Pot", (0, 0, 0.095 * scale), 0.11 * scale, 0.19 * scale, pot_mat, col, verts=20)
    pot.parent = parent
    soil = add_cylinder(f"{name}_Soil", (0, 0, 0.18 * scale), 0.10 * scale, 0.02 * scale, soil_mat, col, verts=16)
    soil.parent = parent

    # Create arched lanceolate leaves via bmesh
    for i in range(13):
        angle = (i / 13.0) * math.pi * 2 + (i % 2) * 0.28
        tier = i % 3
        stem_h = (0.14 + tier * 0.08) * scale

        mesh = bpy.data.meshes.new(f"{name}_Leaf_{i}_mesh")
        leaf = bpy.data.objects.new(f"{name}_Leaf_{i}", mesh)
        bm = bmesh.new()
        segs = 6
        L = 0.28 * scale * (0.82 + (i % 3) * 0.15)
        W = 0.068 * scale
        prev_row = None
        for s in range(segs + 1):
            t = s / segs
            width = math.sin(t * math.pi) * W
            y_pos = t * L
            z_arch = -((t ** 1.7) * 0.08 * scale)
            v_l = bm.verts.new((-width, y_pos, z_arch + width * 0.18))
            v_c = bm.verts.new((0.0, y_pos, z_arch))
            v_r = bm.verts.new((width, y_pos, z_arch + width * 0.18))
            row = (v_l, v_c, v_r)
            if prev_row is not None:
                bm.faces.new((prev_row[0], prev_row[1], row[1], row[0]))
                bm.faces.new((prev_row[1], prev_row[2], row[2], row[1]))
            prev_row = row
        bm.to_mesh(mesh)
        bm.free()
        for p in mesh.polygons:
            p.use_smooth = True
        leaf.data.materials.append(leaf_mat)
        leaf.location = (math.cos(angle) * 0.03 * scale, math.sin(angle) * 0.03 * scale, 0.18 * scale + stem_h * 0.75)
        leaf.rotation_euler = (0.35 + tier * 0.18, 0, angle - math.pi / 2)
        link_obj(leaf, col)
        leaf.parent = parent

    return parent


def build_framed_painting(name, loc, rot_z, width, height, img_path, frame_mat, matboard_mat, col):
    parent = bpy.data.objects.new(name, None)
    parent.location = loc
    parent.rotation_euler = (0, 0, rot_z)
    link_obj(parent, col)

    border = 0.048
    frame = add_box(f"{name}_Frame", (0, 0, 0), (width + border * 2, 0.035, height + border * 2), frame_mat, col, bevel_width=0.008)
    frame.parent = parent

    matboard = add_box(f"{name}_Mat", (0, -0.016, 0), (width + 0.028, 0.006, height + 0.028), matboard_mat, col)
    matboard.parent = parent

    art_mat = make_pbr_material(f"{name}_ArtMat", roughness=0.45, image_path=img_path)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -0.020, 0), rotation=(math.pi / 2, 0, 0))
    art = bpy.context.active_object
    art.name = f"{name}_Canvas"
    art.scale = (width, height, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    art.data.materials.append(art_mat)
    link_obj(art, col)
    art.parent = parent
    return parent


def build_scene():
    reset_scene()

    col_room = get_or_create_collection("Architecture")
    col_furn = get_or_create_collection("Furniture")
    col_decor = get_or_create_collection("Decor_And_Art")
    col_lights = get_or_create_collection("Lighting")

    # Materials
    wall_mat = make_pbr_material("Wall_Plaster", color=(0.89, 0.85, 0.79, 1.0), roughness=0.86)
    ceil_mat = make_pbr_material("Ceiling_White", color=(0.94, 0.92, 0.89, 1.0), roughness=0.9)
    trim_mat = make_pbr_material("Trim_White", color=(0.96, 0.94, 0.91, 1.0), roughness=0.52)
    pine_mat = make_pbr_material("Pine_Wood", color=(0.72, 0.49, 0.25, 1.0), roughness=0.48)
    dark_wood_mat = make_pbr_material("Dark_Wood", color=(0.24, 0.14, 0.08, 1.0), roughness=0.42)
    med_wood_mat = make_pbr_material("Medium_Wood", color=(0.48, 0.28, 0.14, 1.0), roughness=0.42)
    black_metal_mat = make_pbr_material("Black_Metal", color=(0.06, 0.07, 0.08, 1.0), roughness=0.32, metallic=0.75)
    silver_metal_mat = make_pbr_material("Brushed_Nickel", color=(0.76, 0.78, 0.81, 1.0), roughness=0.24, metallic=0.88)
    gold_metal_mat = make_pbr_material("Gold_Metal", color=(0.82, 0.65, 0.30, 1.0), roughness=0.22, metallic=0.9)

    floor_mat = make_pbr_material(
        "Wood_Laminate_Floor",
        roughness=0.36,
        metallic=0.04,
        image_path=os.path.join(BLENDER_TEX_DIR, "wood_floor.png"),
        bump_path=os.path.join(BLENDER_TEX_DIR, "wood_bump.png"),
        bump_strength=0.18,
        uv_scale=(3.5, 5.2),
    )
    rug_mat = make_pbr_material(
        "Geometric_Rug",
        roughness=0.92,
        image_path=os.path.join(BLENDER_TEX_DIR, "rug_albedo.png"),
        bump_path=os.path.join(BLENDER_TEX_DIR, "rug_bump.png"),
        bump_strength=0.22,
    )
    sofa_fabric_mat = make_pbr_material(
        "Sofa_Beige_Slipcover",
        color=(0.94, 0.90, 0.84, 1.0),
        roughness=0.88,
        image_path=os.path.join(BLENDER_TEX_DIR, "sofa_fabric.png"),
        uv_scale=(5.0, 5.0),
    )
    cushion_terra_mat = make_pbr_material(
        "Cushion_Terracotta",
        roughness=0.78,
        image_path=os.path.join(PUBLIC_TEX_DIR, "cushion-terra-real.jpg"),
    )
    cushion_dark_mat = make_pbr_material(
        "Cushion_DarkFloral",
        roughness=0.78,
        image_path=os.path.join(PUBLIC_TEX_DIR, "cushion-dark-real.jpg"),
    )
    throw_mat = make_pbr_material(
        "Throw_Blanket",
        roughness=0.84,
        image_path=os.path.join(BLENDER_TEX_DIR, "throw_blanket.png"),
        uv_scale=(2.0, 2.0),
    )
    tablecloth_mat = make_pbr_material(
        "Floral_Tablecloth",
        roughness=0.82,
        image_path=os.path.join(PUBLIC_TEX_DIR, "tablecloth-real.jpg"),
        uv_scale=(3.0, 3.0),
    )
    coral_trim_mat = make_pbr_material("Coral_Hem_Trim", color=(0.82, 0.36, 0.38, 1.0), roughness=0.84)
    chair_pad_mat = make_pbr_material("Chair_Beige_Pad", color=(0.76, 0.68, 0.56, 1.0), roughness=0.8)
    leaf_mat = make_pbr_material("Foliage_Green", color=(0.14, 0.32, 0.15, 1.0), roughness=0.45)
    pot_dark_mat = make_pbr_material("Pot_Dark", color=(0.12, 0.11, 0.10, 1.0), roughness=0.52)
    pot_white_mat = make_pbr_material("Pot_White", color=(0.94, 0.92, 0.89, 1.0), roughness=0.35)
    soil_mat = make_pbr_material("Soil", color=(0.12, 0.08, 0.05, 1.0), roughness=0.95)
    sheer_mat = make_pbr_material("Sheer_Voile", color=(0.98, 0.97, 0.95, 1.0), roughness=0.82, alpha=0.52)
    drape_mat = make_pbr_material("Bronze_Drape", color=(0.56, 0.38, 0.24, 1.0), roughness=0.74)
    glass_mat = make_pbr_material("Window_Glass", color=(0.92, 0.96, 1.0, 1.0), roughness=0.08, alpha=0.16)
    frosted_glass_mat = make_pbr_material("Frosted_Shade", color=(0.96, 0.95, 0.92, 1.0), roughness=0.3, alpha=0.82)
    bulb_mat = make_pbr_material("Lamp_Bulb", color=(1.0, 0.95, 0.84, 1.0), roughness=0.2, emission=(1.0, 0.84, 0.56), emission_strength=0.6)
    shade_cream_mat = make_pbr_material("Lamp_Shade_Cream", color=(0.84, 0.79, 0.72, 1.0), roughness=0.78)
    matboard_mat = make_pbr_material("Frame_Matboard", color=(0.95, 0.93, 0.89, 1.0), roughness=0.85)
    frame_silver_mat = make_pbr_material("Frame_SilverGold", color=(0.74, 0.68, 0.56, 1.0), roughness=0.38, metallic=0.38)
    frame_dark_mat = make_pbr_material("Frame_Dark", color=(0.30, 0.22, 0.14, 1.0), roughness=0.45, metallic=0.15)

    # ==========================================================
    # 1. ARCHITECTURAL SHELL (Exact Compact Proportions: 3.44m x 6.25m)
    # ==========================================================
    # Wood Floor (covers room + kitchen + hallway)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.8, -0.4, 0.0))
    floor = bpy.context.active_object
    floor.name = "Floor_Laminate"
    floor.scale = (6.2, 8.8, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    floor.data.materials.append(floor_mat)
    link_obj(floor, col_room)

    # Ceiling
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.8, -0.4, 2.50), rotation=(math.pi, 0, 0))
    ceil = bpy.context.active_object
    ceil.name = "Ceiling"
    ceil.scale = (6.2, 8.8, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    ceil.data.materials.append(ceil_mat)
    link_obj(ceil, col_room)

    def add_wall_with_trim(name, x, y, w, d, h=2.50, z_center=1.25):
        add_box(name, (x, y, z_center), (w, d, h), wall_mat, col_room)
        if h >= 2.4:
            add_box(f"{name}_Base", (x, y, 0.048), (w + 0.015, d + 0.015, 0.095), trim_mat, col_room)
            add_box(f"{name}_Crown", (x, y, 2.50 - 0.038), (w + 0.022, d + 0.022, 0.075), trim_mat, col_room)

    # Left Wall (x = -1.72, y = -2.85..+3.40)
    add_wall_with_trim("Wall_Left", -1.77, 0.275, 0.10, 6.25)

    # Dining Back Wall (y = -2.85, x = -1.72..+0.78 -> opens to hallway on right)
    add_wall_with_trim("Wall_DiningBack", -0.47, -2.90, 2.50, 0.10)

    # Right Wall (x = +1.72):
    # Solid living section (y = +0.15..+3.40)
    add_wall_with_trim("Wall_Right_Living", 1.77, 1.775, 0.10, 3.25)
    # Pass-through wall section (y = -1.15..+0.15)
    add_box("Wall_PassThrough_Bottom", (1.77, -0.50, 0.475), (0.10, 1.30, 0.95), wall_mat, col_room)
    add_box("Wall_PassThrough_Base", (1.77, -0.50, 0.048), (0.115, 1.30, 0.095), trim_mat, col_room)
    add_box("Wall_PassThrough_Top", (1.77, -0.50, 2.24), (0.10, 1.30, 0.52), wall_mat, col_room)
    add_box("Wall_PassThrough_Crown", (1.77, -0.50, 2.462), (0.122, 1.30, 0.075), trim_mat, col_room)
    # Stub pillar at dining end of pass-through (y = -1.35..-1.15)
    add_wall_with_trim("Wall_Right_Pillar", 1.77, -1.25, 0.10, 0.20)

    # Pine Frame around Pass-Through Window ("Pasaplatos")
    add_box("Pasaplatos_Sill", (1.75, -0.50, 0.96), (0.22, 1.42, 0.04), pine_mat, col_room, bevel_width=0.008)
    add_box("Pasaplatos_TopFrame", (1.76, -0.50, 1.98), (0.15, 1.38, 0.05), pine_mat, col_room, bevel_width=0.006)
    add_box("Pasaplatos_SideL", (1.76, 0.17, 1.47), (0.15, 0.05, 1.06), pine_mat, col_room, bevel_width=0.006)
    add_box("Pasaplatos_SideR", (1.76, -1.17, 1.47), (0.15, 0.05, 1.06), pine_mat, col_room, bevel_width=0.006)

    # Kitchen Enclosing Walls & Interior (x = +1.72..+3.45, y = -1.45..+0.40)
    add_wall_with_trim("Wall_Kitchen_Back", 3.50, -1.4, 0.10, 5.8)
    add_wall_with_trim("Wall_Kitchen_Side", 2.60, 0.45, 1.80, 0.10)
    add_wall_with_trim("Wall_Hallway_Back", 1.95, -4.45, 3.10, 0.10)
    add_wall_with_trim("Wall_Hallway_Left", 0.73, -3.65, 0.10, 1.60)

    # Kitchen Appliances & Cabinets (clearly visible through Pasaplatos)
    tile_mat = make_pbr_material("Kitchen_Tiles", color=(0.89, 0.90, 0.88, 1.0), roughness=0.32)
    fridge_mat = make_pbr_material("Kitchen_Fridge", color=(0.24, 0.26, 0.29, 1.0), roughness=0.28, metallic=0.6)
    add_box("Kitchen_Backsplash", (3.44, -0.50, 1.25), (0.02, 2.1, 2.2), tile_mat, col_room)
    add_box("Kitchen_Fridge", (3.08, -0.95, 0.90), (0.68, 0.70, 1.80), fridge_mat, col_furn, bevel_width=0.02)
    add_box("Kitchen_Fridge_Seam", (2.735, -0.95, 1.22), (0.01, 0.69, 0.015), black_metal_mat, col_decor)
    add_box("Kitchen_Fridge_Handle", (2.725, -0.68, 1.02), (0.02, 0.02, 0.36), silver_metal_mat, col_decor)
    mag_colors = [(0.82, 0.25, 0.25, 1), (0.45, 0.28, 0.68, 1), (0.90, 0.65, 0.22, 1), (0.28, 0.68, 0.82, 1)]
    for m in range(10):
        mm = make_pbr_material(f"Magnet_{m}", color=mag_colors[m % 4], roughness=0.4)
        add_box(f"Fridge_Magnet_{m}", (2.735, -0.75 - (m // 4) * 0.15, 1.15 + (m % 4) * 0.13), (0.015, 0.04, 0.04), mm, col_decor)
    add_box("Kitchen_Counter", (3.12, 0.05, 0.44), (0.65, 1.2, 0.88), pine_mat, col_furn)
    add_box("Kitchen_UpperCab", (3.22, 0.05, 1.82), (0.44, 1.1, 0.68), pine_mat, col_furn)
    add_box("Kitchen_Microwave", (3.08, 0.05, 1.54), (0.30, 0.46, 0.26), pot_white_mat, col_furn)
    add_box("Kitchen_Toaster", (3.06, -0.15, 1.02), (0.26, 0.36, 0.22), silver_metal_mat, col_furn)

    # Hallway Wine-Rack / Glass-Door Bar Cabinet (open wine cubbies + upper display frame)
    bar_cab = bpy.data.objects.new("Hallway_BarCabinet", None)
    bar_cab.location = (2.05, -4.16, 0.0)
    link_obj(bar_cab, col_furn)
    # Lower cabinet box & open right wine grid
    add_box("Bar_LeftDoor", (-0.26, 0.0, 0.42), (0.50, 0.42, 0.84), med_wood_mat, col_furn, bevel_width=0.01).parent = bar_cab
    add_box("Bar_WineBack", (0.26, -0.18, 0.42), (0.52, 0.04, 0.84), dark_wood_mat, col_furn).parent = bar_cab
    add_box("Bar_CounterTop", (0.0, 0.0, 0.86), (1.08, 0.46, 0.04), med_wood_mat, col_furn, bevel_width=0.008).parent = bar_cab
    for wrow in range(4):
        add_box(f"Bar_WineShelf_{wrow}", (0.26, 0.0, 0.12 + wrow * 0.20), (0.52, 0.38, 0.02), med_wood_mat, col_furn).parent = bar_cab
    for wcol in range(4):
        add_box(f"Bar_WineDiv_{wcol}", (0.02 + wcol * 0.16, 0.0, 0.42), (0.02, 0.38, 0.72), med_wood_mat, col_furn).parent = bar_cab
    bottle_mat = make_pbr_material("Wine_Bottle", color=(0.10, 0.24, 0.14, 1.0), roughness=0.18)
    for gx in range(3):
        for gy in range(3):
            b = add_cylinder(
                f"WineBottle_{gx}_{gy}",
                (0.10 + gx * 0.16, 0.02, 0.22 + gy * 0.20),
                0.034,
                0.28,
                bottle_mat,
                col_decor,
                rot=(math.pi / 2, 0, 0),
                verts=12,
            )
            b.parent = bar_cab
    # Upper glass display cabinet frame
    add_box("Bar_UpperBack", (0.0, -0.18, 1.38), (1.04, 0.04, 1.02), dark_wood_mat, col_furn).parent = bar_cab
    add_box("Bar_UpperTop", (0.0, 0.0, 1.90), (1.08, 0.42, 0.04), med_wood_mat, col_furn, bevel_width=0.008).parent = bar_cab
    for ux in (-0.51, 0.0, 0.51):
        add_box(f"Bar_UpperPost_{ux}", (ux, 0.0, 1.38), (0.04, 0.38, 1.02), med_wood_mat, col_furn).parent = bar_cab
    add_box("Bar_UpperShelf", (0.0, 0.0, 1.38), (1.00, 0.34, 0.025), med_wood_mat, col_furn).parent = bar_cab
    add_box("Bar_UpperGlass", (0.0, 0.17, 1.38), (0.98, 0.01, 0.96), glass_mat, col_furn).parent = bar_cab

    # Open 2-Tier Wooden Corner Console Stand next to Dining Back Wall (as in 122503483)
    cstand = bpy.data.objects.new("Dining_CornerStand", None)
    cstand.location = (0.88, -2.62, 0.0)
    link_obj(cstand, col_furn)
    for sx in (-0.18, 0.18):
        for sy in (-0.18, 0.18):
            add_box(f"CS_Leg_{sx}_{sy}", (sx, sy, 0.48), (0.035, 0.035, 0.96), med_wood_mat, col_furn, bevel_width=0.005).parent = cstand
    add_box("CS_Top", (0, 0, 0.96), (0.42, 0.42, 0.03), med_wood_mat, col_furn, bevel_width=0.006).parent = cstand
    add_box("CS_Mid", (0, 0, 0.48), (0.38, 0.38, 0.025), med_wood_mat, col_furn, bevel_width=0.005).parent = cstand
    build_botanical_plant("CornerStand_PlantTop", (-0.05, 0.04, 0.975), 0.72, leaf_mat, pot_dark_mat, soil_mat, col_decor).parent = cstand
    build_botanical_plant("CornerStand_PlantLow", (0.02, 0.0, 0.495), 0.65, leaf_mat, pot_dark_mat, soil_mat, col_decor).parent = cstand

    # Hallway framed artworks (visible in 122505536)
    build_framed_painting("Cuadro_Pasillo_1", (0.79, -3.55, 1.60), math.pi / 2, 0.65, 0.50, os.path.join(PUBLIC_TEX_DIR, "art-lake.jpg"), frame_silver_mat, matboard_mat, col_decor)
    build_framed_painting("Cuadro_Pasillo_2", (1.25, -4.38, 1.56), math.pi, 0.52, 0.42, os.path.join(PUBLIC_TEX_DIR, "art-mountain.jpg"), frame_silver_mat, matboard_mat, col_decor)

    # Balcony Window Wall (y = +3.40)
    add_box("Window_TopBar", (0, 3.40, 2.46), (3.54, 0.10, 0.08), black_metal_mat, col_room)
    add_box("Window_BotBar", (0, 3.40, 0.03), (3.54, 0.10, 0.06), black_metal_mat, col_room)
    for mx in (-1.70, -0.56, 0.56, 1.70):
        add_box(f"Window_Mullion_{mx}", (mx, 3.40, 1.25), (0.045, 0.08, 2.44), black_metal_mat, col_room)
    add_box("Window_Glass", (0, 3.40, 1.25), (3.40, 0.01, 2.40), glass_mat, col_room)

    # Balcony Railing & Exterior Backdrop
    add_box("Balcony_Rail", (0, 3.95, 1.02), (3.8, 0.04, 0.04), black_metal_mat, col_room)
    for rx in (-1.6, -1.0, -0.4, 0.2, 0.8, 1.4):
        add_box(f"Balcony_Post_{rx}", (rx, 3.95, 0.51), (0.025, 0.025, 1.02), black_metal_mat, col_room)

    # Exterior sky, trees & ochre building (matches photo view outside window)
    sky_mat = make_pbr_material("Exterior_Sky", color=(0.76, 0.87, 0.95, 1.0), roughness=1.0, emission=(0.76, 0.87, 0.95), emission_strength=0.85)
    add_box("Exterior_Backdrop", (0, 6.4, 2.0), (9.5, 0.05, 5.5), sky_mat, col_room)
    ochre_mat = make_pbr_material("Exterior_Building", color=(0.82, 0.56, 0.34, 1.0), roughness=0.8)
    add_box("Exterior_Apartment", (1.2, 5.8, 1.5), (1.6, 0.6, 3.2), ochre_mat, col_room)
    tree_ext_mat = make_pbr_material("Exterior_Trees", color=(0.28, 0.44, 0.20, 1.0), roughness=0.85)
    for ti in range(9):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.45 + (ti % 3) * 0.12, location=(-2.0 + ti * 0.5, 4.9 + (ti % 2) * 0.3, 0.95 + (ti % 3) * 0.18))
        tr = bpy.context.active_object
        tr.name = f"Exterior_Tree_{ti}"
        bpy.ops.object.shade_smooth()
        tr.data.materials.append(tree_ext_mat)
        link_obj(tr, col_room)

    # Curtain Rod + Pleated Sheer Curtains + Asymmetric Gathered Bronze Drapes
    add_cylinder("Curtain_Rod", (0, 3.26, 2.42), 0.015, 3.44, black_metal_mat, col_decor, rot=(0, math.pi / 2, 0), verts=14)
    # Pleated sheer mesh
    sheer_mesh = bpy.data.meshes.new("Sheer_Curtain_mesh")
    sheer_obj = bpy.data.objects.new("Sheer_Curtain", sheer_mesh)
    bm = bmesh.new()
    nx, nz = 68, 8
    verts_grid = []
    for iz in range(nz + 1):
        row = []
        z = (iz / nz) * 2.38 + 0.02
        for ix in range(nx + 1):
            x = -1.66 + (ix / nx) * 3.32
            y = 3.26 + math.sin(x * 24.0) * 0.026
            row.append(bm.verts.new((x, y, z)))
        verts_grid.append(row)
    for iz in range(nz):
        for ix in range(nx):
            bm.faces.new((verts_grid[iz][ix], verts_grid[iz][ix + 1], verts_grid[iz + 1][ix + 1], verts_grid[iz + 1][ix]))
    bm.to_mesh(sheer_mesh)
    bm.free()
    for p in sheer_mesh.polygons:
        p.use_smooth = True
    sheer_obj.data.materials.append(sheer_mat)
    link_obj(sheer_obj, col_decor)

    # Left Bronze Curtain: anchored along the outer left edge (-1.68), fanning wider at top (-1.68..-0.85)
    # and sweeping smoothly inward to the tie-back at z=1.05, then flaring behind the sofa arm!
    def build_gathered_drape(name, outer_x, inner_top_x, inner_tie_x, z_tie=1.05):
        mesh = bpy.data.meshes.new(name + "_mesh")
        obj = bpy.data.objects.new(name, mesh)
        bm = bmesh.new()
        rings, nx = 24, 20
        grid = []
        for iz in range(rings + 1):
            t = iz / rings
            z = 0.03 + t * 2.38
            tie_influence = math.exp(-((z - z_tie) ** 2) / 0.38)
            inner_x = inner_top_x + (inner_tie_x - inner_top_x) * tie_influence
            # Outer edge pulls slightly inward only near the tie-back knot
            cur_outer_x = outer_x + (inner_tie_x - outer_x) * 0.32 * tie_influence
            row = []
            for ix in range(nx + 1):
                u = ix / nx
                x = cur_outer_x + (inner_x - cur_outer_x) * u
                pleat_y = math.sin(u * math.pi * 6.0) * (0.045 - 0.02 * tie_influence)
                row.append(bm.verts.new((x, 3.16 + pleat_y, z)))
            grid.append(row)
        for iz in range(rings):
            for ix in range(nx):
                bm.faces.new((grid[iz][ix], grid[iz][ix + 1], grid[iz + 1][ix + 1], grid[iz + 1][ix]))
        bm.to_mesh(mesh)
        bm.free()
        for p in mesh.polygons:
            p.use_smooth = True
        obj.data.materials.append(drape_mat)
        link_obj(obj, col_decor)
        return obj

    build_gathered_drape("Drape_Left_Swept", -1.68, -0.78, -1.16, z_tie=1.05)
    build_gathered_drape("Drape_Right", 1.68, 1.32, 1.50, z_tie=1.10)

    # ==========================================================
    # 2. LIVING ROOM FURNITURE (Exact Compact Layout)
    # ==========================================================
    # Geometric Rug (tightly between the two sofas)
    add_box("Living_Rug", (0.0, 1.18, 0.008), (1.96, 2.34, 0.016), rug_mat, col_furn, bevel_width=0.006)

    # 3-Seat Main Sofa (Left Wall, facing +X -> rot_z = -pi/2? Local +Y faces +X when rot_z = -pi/2)
    build_sofa(
        "Sofa_Principal",
        (-1.26, 1.24, 0.0),
        -math.pi / 2,
        3,
        sofa_fabric_mat,
        [cushion_terra_mat, cushion_dark_mat],
        col_furn,
    )

    # 2-Seat Secondary Sofa (Right Wall, facing -X -> rot_z = +pi/2)
    build_sofa(
        "Sofa_Secundario",
        (1.26, 1.12, 0.0),
        math.pi / 2,
        2,
        sofa_fabric_mat,
        [cushion_terra_mat, cushion_dark_mat],
        col_furn,
        throw_mat=throw_mat,
    )

    # Ceiling-Mounted Smart TV + Mount (Right window corner, angled diagonally)
    tv_mount = bpy.data.objects.new("TV_Mount", None)
    tv_mount.location = (1.06, 2.86, 2.50)
    link_obj(tv_mount, col_furn)

    plate = add_cylinder("TV_Plate", (0, 0, -0.015), 0.085, 0.03, black_metal_mat, col_furn, verts=18)
    plate.parent = tv_mount
    pole = add_cylinder("TV_Pole", (0, 0, -0.32), 0.022, 0.62, black_metal_mat, col_furn, verts=14)
    pole.parent = tv_mount

    tv_holder = bpy.data.objects.new("TV_Holder", None)
    tv_holder.location = (0, 0, -0.60)
    tv_holder.rotation_euler = (-0.08, 0.0, 2.48)  # Facing diagonally toward sofas & dining
    link_obj(tv_holder, col_furn)
    tv_holder.parent = tv_mount

    chassis = add_box("TV_Chassis", (0, 0, 0), (1.14, 0.04, 0.65), black_metal_mat, col_furn, bevel_width=0.01)
    chassis.parent = tv_holder

    # Separate TV_Screen mesh so Three.js drives live video texture & emissive ON/OFF
    tv_off_mat = make_pbr_material("TV_Screen_Mat", color=(0.04, 0.05, 0.06, 1.0), roughness=0.12, metallic=0.15)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0.022, 0), rotation=(math.pi / 2, 0, math.pi))
    tv_screen = bpy.context.active_object
    tv_screen.name = "TV_Screen"
    tv_screen.scale = (1.09, 0.60, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    tv_screen.data.materials.append(tv_off_mat)
    link_obj(tv_screen, col_furn)
    tv_screen.parent = tv_holder

    # 2-Tier Wooden Media Console under/beside TV (prominently visible as in 122439620 & 122443054)
    console = bpy.data.objects.new("Consola_Multimedia", None)
    console.location = (1.36, 2.74, 0.0)
    console.rotation_euler = (0, 0, -0.22)
    link_obj(console, col_furn)
    for lx in (-0.42, 0.42):
        for ly in (-0.20, 0.20):
            leg = add_box(f"Con_Leg_{lx}_{ly}", (lx, ly, 0.37), (0.04, 0.04, 0.74), med_wood_mat, col_furn, bevel_width=0.006)
            leg.parent = console
    top_sh = add_box("Con_TopShelf", (0, 0, 0.74), (0.94, 0.48, 0.035), med_wood_mat, col_furn, bevel_width=0.008)
    top_sh.parent = console
    mid_sh = add_box("Con_MidShelf", (0, 0, 0.36), (0.88, 0.44, 0.03), med_wood_mat, col_furn, bevel_width=0.006)
    mid_sh.parent = console
    # Stereo system on lower shelf
    stereo = add_box("Con_Stereo", (-0.16, 0, 0.49), (0.38, 0.28, 0.22), black_metal_mat, col_furn, bevel_width=0.01)
    stereo.parent = console
    # White orchid & tall cat figurine on top shelf
    o_pot = add_cylinder("Orchid_Pot", (-0.24, 0.02, 0.82), 0.068, 0.12, pot_white_mat, col_decor, verts=16)
    o_pot.parent = console
    o_stem = add_cylinder("Orchid_Stem", (-0.24, 0.02, 1.00), 0.006, 0.32, leaf_mat, col_decor, verts=8)
    o_stem.parent = console
    for b in range(4):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.032, location=(-0.24 + (b % 2) * 0.035, 0.04, 1.04 + b * 0.045))
        bl = bpy.context.active_object
        bl.name = f"Orchid_Bloom_{b}"
        bl.scale = (1.1, 0.4, 0.9)
        bl.data.materials.append(pot_white_mat)
        link_obj(bl, col_decor)
        bl.parent = console
    cat_mat = make_pbr_material("Cat_Wood", color=(0.38, 0.36, 0.34, 1.0), roughness=0.65)
    cat = add_cylinder("Cat_Figurine", (0.28, -0.05, 0.98), 0.06, 0.44, cat_mat, col_decor, verts=14)
    cat.parent = console

    # Tall leafy Schefflera tree beside 2-seat sofa & console
    build_botanical_plant("Plant_Schefflera", (1.42, 2.12, 0.0), 1.38, leaf_mat, pot_dark_mat, soil_mat, col_decor)
    # Corner plant near left window
    build_botanical_plant("Plant_WindowCorner", (-1.42, 2.95, 0.0), 1.15, leaf_mat, pot_dark_mat, soil_mat, col_decor)

    # Small side tables
    # Left dark-wood corner stand (between 3-seat sofa & dining)
    lstand = bpy.data.objects.new("Mesita_Izquierda", None)
    lstand.location = (-1.48, -0.08, 0.0)
    link_obj(lstand, col_furn)
    add_box("LS_Top", (0, 0, 0.54), (0.40, 0.40, 0.03), dark_wood_mat, col_furn, bevel_width=0.006).parent = lstand
    for sx in (-0.15, 0.15):
        for sy in (-0.15, 0.15):
            add_box(f"LS_Leg_{sx}_{sy}", (sx, sy, 0.27), (0.035, 0.035, 0.54), dark_wood_mat, col_furn).parent = lstand
    build_botanical_plant("LS_Plant", (-0.03, 0.02, 0.555), 0.80, leaf_mat, pot_dark_mat, soil_mat, col_decor).parent = lstand

    # Right black side table below Pass-Through Window
    rtable = bpy.data.objects.new("Mesita_Negra", None)
    rtable.location = (1.44, -0.22, 0.0)
    link_obj(rtable, col_furn)
    add_box("RT_Top", (0, 0, 0.52), (0.46, 0.46, 0.032), black_metal_mat, col_furn, bevel_width=0.008).parent = rtable
    for sx in (-0.19, 0.19):
        for sy in (-0.19, 0.19):
            add_box(f"RT_Leg_{sx}_{sy}", (sx, sy, 0.26), (0.035, 0.035, 0.52), black_metal_mat, col_furn).parent = rtable
    build_botanical_plant("RT_Monstera", (-0.04, 0.02, 0.535), 0.88, leaf_mat, pot_dark_mat, soil_mat, col_decor).parent = rtable

    # ==========================================================
    # 3. DINING SET (Compact Round Table with Flowing Cloth + 4 Curved Chairs)
    # ==========================================================
    dining = bpy.data.objects.new("Mesa_Comedor", None)
    dining.location = (-0.36, -1.45, 0.0)
    link_obj(dining, col_furn)

    add_cylinder("Dining_Pedestal", (0, 0, 0.36), 0.16, 0.72, dark_wood_mat, col_furn, verts=20).parent = dining

    # Draped tablecloth with organic natural hanging folds
    cloth_mesh = bpy.data.meshes.new("Tablecloth_mesh")
    cloth_obj = bpy.data.objects.new("Tablecloth_Draped", cloth_mesh)
    bm = bmesh.new()
    segs_a, segs_r = 64, 14
    r_table = 0.54
    drop_len = 0.34
    rings = []
    # Center cap vertex
    v_center = bm.verts.new((0, 0, 0.755))
    for ir in range(1, segs_r + 1):
        t = ir / segs_r
        ring = []
        for ia in range(segs_a):
            a = (ia / segs_a) * math.pi * 2
            if t <= 0.62:
                # Flat tabletop portion
                rr = (t / 0.62) * r_table
                zz = 0.755
            else:
                # Hanging draped skirt portion
                d_t = (t - 0.62) / 0.38
                fold = math.sin(a * 14.0) * 0.035 * d_t + math.cos(a * 7.0) * 0.018 * d_t
                rr = r_table + d_t * 0.08 + fold
                zz = 0.755 - d_t * drop_len
            ring.append(bm.verts.new((math.cos(a) * rr * 1.06, math.sin(a) * rr * 0.94, zz)))
        rings.append(ring)

    # Center triangle fan + quad rings
    for ia in range(segs_a):
        na = (ia + 1) % segs_a
        bm.faces.new((v_center, rings[0][ia], rings[0][na]))
    for ir in range(len(rings) - 1):
        for ia in range(segs_a):
            na = (ia + 1) % segs_a
            bm.faces.new((rings[ir][ia], rings[ir + 1][ia], rings[ir + 1][na], rings[ir][na]))

    bm.to_mesh(cloth_mesh)
    bm.free()
    # Planar UV projection for floral cloth
    uv_l = cloth_mesh.uv_layers.new(name="UVMap")
    for poly in cloth_mesh.polygons:
        for li in poly.loop_indices:
            co = cloth_mesh.vertices[cloth_mesh.loops[li].vertex_index].co
            uv_l.data[li].uv = (co.x * 0.65 + 0.5, co.y * 0.65 + 0.5)
    for p in cloth_mesh.polygons:
        p.use_smooth = True
    cloth_obj.data.materials.append(tablecloth_mat)
    link_obj(cloth_obj, col_furn)
    cloth_obj.parent = dining

    # Gold vase + peach rose bouquet + black TV remote
    vase = add_cylinder("Dining_Vase", (0.04, 0.02, 0.84), 0.052, 0.17, gold_metal_mat, col_decor, verts=20)
    vase.parent = dining
    # Layered peach roses + green bouquet leaves + coral tablecloth hem trim
    rose_colors = [(0.95, 0.72, 0.60, 1.0), (0.91, 0.60, 0.49, 1.0), (0.97, 0.80, 0.70, 1.0)]
    for ri in range(7):
        rmat = make_pbr_material(f"Rose_Mat_{ri%3}", color=rose_colors[ri % 3], roughness=0.58)
        ang = (ri / 7.0) * math.pi * 2
        rad = 0.0 if ri == 0 else 0.056
        rx = 0.04 + math.cos(ang) * rad
        ry = 0.02 + math.sin(ang) * rad
        rz = 0.955 + (0.022 if ri == 0 else 0)
        # Inner rose bud + outer cupped petals
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.018, location=(rx, ry, rz))
        bud = bpy.context.active_object
        bud.name = f"Dining_RoseBud_{ri}"
        bpy.ops.object.shade_smooth()
        bud.data.materials.append(rmat)
        link_obj(bud, col_decor)
        bud.parent = dining
        for pi in range(5):
            pa = (pi / 5.0) * math.pi * 2 + ri
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.020, location=(rx + math.cos(pa) * 0.017, ry + math.sin(pa) * 0.017, rz - 0.003))
            pet = bpy.context.active_object
            pet.name = f"Dining_RosePetal_{ri}_{pi}"
            pet.scale = (1.1, 0.55, 1.2)
            pet.rotation_euler = (0.35, 0, pa + math.pi / 2)
            bpy.ops.object.shade_smooth()
            pet.data.materials.append(rmat)
            link_obj(pet, col_decor)
            pet.parent = dining

    # Coral woven border ring along bottom of tablecloth
    hem_mesh = bpy.data.meshes.new("Tablecloth_Hem_mesh")
    hem_obj = bpy.data.objects.new("Tablecloth_Hem", hem_mesh)
    bm_h = bmesh.new()
    hem_top = []
    hem_bot = []
    for ia in range(segs_a):
        a = (ia / segs_a) * math.pi * 2
        fold = math.sin(a * 14.0) * 0.035 + math.cos(a * 7.0) * 0.018
        rr = r_table + 0.08 + fold
        px, py = math.cos(a) * rr * 1.06, math.sin(a) * rr * 0.94
        hem_top.append(bm_h.verts.new((px, py, 0.755 - drop_len + 0.035)))
        hem_bot.append(bm_h.verts.new((px * 1.01, py * 1.01, 0.755 - drop_len)))
    for ia in range(segs_a):
        na = (ia + 1) % segs_a
        bm_h.faces.new((hem_bot[ia], hem_bot[na], hem_top[na], hem_top[ia]))
    bm_h.to_mesh(hem_mesh)
    bm_h.free()
    for p in hem_mesh.polygons:
        p.use_smooth = True
    hem_obj.data.materials.append(coral_trim_mat)
    link_obj(hem_obj, col_furn)
    hem_obj.parent = dining

    remote = add_box("Dining_Remote", (-0.18, 0.12, 0.768), (0.048, 0.17, 0.016), black_metal_mat, col_decor, rot=(0, 0, 0.55), bevel_width=0.004)
    remote.parent = dining

    # 4 Dining Chairs arranged neatly around the table
    for ci, (cx, cy, crot) in enumerate([(0, 0.70, math.pi), (0, -0.70, 0), (-0.72, 0, -math.pi / 2), (0.72, 0, math.pi / 2)]):
        ch = build_curved_dining_chair(f"Dining_Chair_{ci}", (cx, cy, 0.0), crot, dark_wood_mat, chair_pad_mat, col_furn)
        ch.parent = dining

    # ==========================================================
    # 4. FRAMED ARTWORKS (Exact Real Photos Facing Into the Room)
    # ==========================================================
    build_framed_painting("Cuadro_LagoAzul", (-1.70, 1.24, 1.62), math.pi / 2, 1.02, 0.76, os.path.join(PUBLIC_TEX_DIR, "art-lake.jpg"), frame_silver_mat, matboard_mat, col_decor)
    build_framed_painting("Cuadro_MontanaVerde", (1.70, 1.12, 1.62), -math.pi / 2, 1.00, 0.75, os.path.join(PUBLIC_TEX_DIR, "art-mountain.jpg"), frame_silver_mat, matboard_mat, col_decor)
    build_framed_painting("Cuadro_Bodegon", (-0.42, -2.83, 1.56), math.pi, 1.02, 0.76, os.path.join(PUBLIC_TEX_DIR, "art-stilllife.jpg"), frame_dark_mat, matboard_mat, col_decor)

    # 3 small stepped frames on left dining wall (facing +X into the room)
    build_framed_painting("Cuadro_Pequeno_1", (-1.70, -1.85, 1.88), math.pi / 2, 0.23, 0.28, os.path.join(PUBLIC_TEX_DIR, "art-small-1.jpg"), frame_dark_mat, matboard_mat, col_decor)
    build_framed_painting("Cuadro_Pequeno_2", (-1.70, -1.96, 1.50), math.pi / 2, 0.24, 0.27, os.path.join(PUBLIC_TEX_DIR, "art-small-2.jpg"), frame_dark_mat, matboard_mat, col_decor)
    build_framed_painting("Cuadro_Pequeno_3", (-1.70, -2.08, 1.08), math.pi / 2, 0.30, 0.36, os.path.join(PUBLIC_TEX_DIR, "art-small-3.jpg"), frame_dark_mat, matboard_mat, col_decor)

    # ==========================================================
    # 5. LIGHTING FIXTURES & CAMERAS
    # ==========================================================
    # 5-Arm Chandelier over Dining Table
    chand = bpy.data.objects.new("Iluminacion_Arana", None)
    chand.location = (-0.36, -1.45, 2.50)
    link_obj(chand, col_decor)
    add_cylinder("Chandelier_Canopy", (0, 0, -0.025), 0.11, 0.05, silver_metal_mat, col_decor, verts=18).parent = chand
    add_cylinder("Chandelier_Stem", (0, 0, -0.15), 0.022, 0.26, silver_metal_mat, col_decor, verts=14).parent = chand
    for i in range(5):
        a = (i / 5.0) * math.pi * 2
        arm = add_cylinder(f"Chand_Arm_{i}", (math.cos(a) * 0.14, math.sin(a) * 0.14, -0.22), 0.009, 0.28, silver_metal_mat, col_decor, rot=(math.sin(a) * 0.7, -math.cos(a) * 0.7, 0), verts=10)
        arm.parent = chand
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.075, radius2=0.025, depth=0.14, location=(math.cos(a) * 0.25, math.sin(a) * 0.25, -0.28))
        tulip = bpy.context.active_object
        tulip.name = f"Chand_Tulip_{i}"
        tulip.rotation_euler = (math.sin(a) * 0.8, -math.cos(a) * 0.8, 0)
        bpy.ops.object.shade_smooth()
        tulip.data.materials.append(frosted_glass_mat)
        link_obj(tulip, col_decor)
        tulip.parent = chand
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.024, location=(math.cos(a) * 0.24, math.sin(a) * 0.24, -0.27))
        bulb = bpy.context.active_object
        bulb.name = f"Chand_Bulb_{i}"
        bulb.data.materials.append(bulb_mat)
        link_obj(bulb, col_decor)
        bulb.parent = chand

    # Tall Floor Lamp with 3 Glass Spheres (back-left dining corner)
    flamp = bpy.data.objects.new("Lampara_Pie_Comedor", None)
    flamp.location = (-1.38, -2.52, 0.0)
    link_obj(flamp, col_decor)
    add_cylinder("FL_Base", (0, 0, 0.015), 0.14, 0.03, silver_metal_mat, col_decor, verts=20).parent = flamp
    add_cylinder("FL_Pole", (0, 0, 0.68), 0.014, 1.36, silver_metal_mat, col_decor, verts=12).parent = flamp
    for si, sz in enumerate((1.12, 1.22, 1.32)):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.036, location=(0, 0, sz))
        sp = bpy.context.active_object
        sp.name = f"FL_GlassSphere_{si}"
        bpy.ops.object.shade_smooth()
        sp.data.materials.append(glass_mat)
        link_obj(sp, col_decor)
        sp.parent = flamp
    add_cylinder("FL_Shade", (0, 0, 1.50), 0.19, 0.26, shade_cream_mat, col_decor, verts=28).parent = flamp

    # Slender Dark Reading Lamp (window-left corner, matching photo 122429379)
    rlamp = bpy.data.objects.new("Lampara_Lectora_Ventana", None)
    rlamp.location = (-1.45, 3.05, 0.0)
    link_obj(rlamp, col_decor)
    add_cylinder("RL_Base", (0, 0, 0.012), 0.11, 0.024, black_metal_mat, col_decor, verts=16).parent = rlamp
    add_cylinder("RL_Stem", (0, 0, 0.76), 0.008, 1.52, black_metal_mat, col_decor, verts=10).parent = rlamp
    bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.055, radius2=0.015, depth=0.11, location=(0.06, -0.05, 1.50))
    rhead = bpy.context.active_object
    rhead.name = "RL_Head"
    rhead.rotation_euler = (0.7, 0.5, 0)
    rhead.data.materials.append(black_metal_mat)
    link_obj(rhead, col_decor)
    rhead.parent = rlamp

    # Scene Lights for Blender Verification Renders
    # 1. Window Area Light
    bpy.ops.object.light_add(type="AREA", location=(0.0, 3.15, 1.30), rotation=(math.pi / 2, 0, 0))
    win_area = bpy.context.active_object
    win_area.name = "Light_WindowArea"
    win_area.data.shape = "RECTANGLE"
    win_area.data.size = 3.2
    win_area.data.size_y = 2.1
    win_area.data.energy = 160.0
    win_area.data.color = (0.94, 0.97, 1.0)
    link_obj(win_area, col_lights)

    # 2. Warm Interior Bounce Fill
    bpy.ops.object.light_add(type="POINT", location=(0.0, -0.4, 2.25))
    fill = bpy.context.active_object
    fill.name = "Light_InteriorFill"
    fill.data.energy = 55.0
    fill.data.shadow_soft_size = 0.8
    fill.data.color = (1.0, 0.95, 0.88)
    link_obj(fill, col_lights)

    # 3. Kitchen Accent Light
    bpy.ops.object.light_add(type="POINT", location=(2.6, -0.5, 2.25))
    klight = bpy.context.active_object
    klight.name = "Light_Kitchen"
    klight.data.energy = 45.0
    klight.data.color = (1.0, 0.94, 0.84)
    link_obj(klight, col_lights)

    # Configure Eevee / Cycles for fast clean verification renders
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 0.65
    scene.eevee.use_bloom = True
    scene.eevee.bloom_threshold = 1.1
    scene.eevee.bloom_intensity = 0.08
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"

    # Helper to render verification cameras
    def render_cam(name, loc, target, out_path):
        bpy.ops.object.camera_add(location=loc)
        cam = bpy.context.active_object
        cam.name = name
        cam.data.lens = 24.0
        direction = Vector(target) - Vector(loc)
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        scene.camera = cam
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)

    # Save .blend before rendering
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)

    render_cam("Cam_VistaGeneral", (0.35, -2.55, 1.52), (-0.05, 1.4, 1.15), PREVIEW_LIVING)
    render_cam("Cam_ComedorYHallway", (-0.85, 1.20, 1.48), (0.35, -2.2, 1.15), PREVIEW_DINING)

    # Export glTF 2.0 (.glb) with embedded textures for Three.js
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
        export_lights=False,
        export_cameras=False,
    )
    print("DONE: Saved", OUT_BLEND, "and exported", OUT_GLB)


if __name__ == "__main__":
    build_scene()
