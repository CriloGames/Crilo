-- Golden Box cosmetic is isolated from Crilo's Daily runs, badges and scores.
-- Only a successfully validated 25-room proof can award it to an account.
CREATE TABLE IF NOT EXISTS public.crilo_escape_cosmetics (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  golden_unlocked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crilo_escape_cosmetics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crilo_escape_cosmetics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.crilo_escape_cosmetics TO authenticated;
CREATE POLICY escape_cosmetic_read_own
ON public.crilo_escape_cosmetics FOR SELECT TO authenticated
USING ((SELECT auth.uid())=user_id);

CREATE OR REPLACE FUNCTION public.crilo_unlock_golden_box(p_routes text[])
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $gold$
DECLARE
  v_user uuid := auth.uid();
  v_maps text[] := ARRAY[
  '#########/#......*#/#.....#.#/#.......#/#.......#/#S......#/#..#...E#/#**...#.#/#########',
  '#########/#.#.....#/#.....S.#/#*###...#/#E......#/##......#/#.*.....#/#....*..#/#########',
  '#########/#..*..#.#/#....#*.#/#...#..##/##......#/#.SE*.#.#/#.......#/#..#....#/#########',
  '#########/##..*#..#/#......##/##..*...#/#*#.##..#/#.......#/##.....S#/##.E....#/#########',
  '#########/#.##.*..#/#.#....##/###.....#/#.......#/#*##....#/#.#.#...#/##.S..E*#/#########',
  '#########/##.E.##.#/#....#..#/#*##.#.##/#.#*.#.##/#.#S##..#/###..#..#/##.#.*###/#########',
  '#########/#*.##...#/#.E.*...#/##.#.S###/#####...#/#.#.*#..#/#.##...##/###.###.#/#########',
  '#########/#..##.#.#/#.#..#.*#/##.#...##/#.#..E#.#/###S#...#/##.*##..#/#.#.##*##/#########',
  '#########/#....#.*#/#.#E..S.#/#.*##..##/##.####.#/#..#..#.#/#.#####.#/#*###..##/#########',
  '#########/##...#*.#/#.###*#.#/#####...#/#.##.#..#/#E..#..S#/#*#.#..##/###....##/#########',
  '#########/###..####/#.*.#...#/#.##...##/#..E.#..#/#S.*##.##/#..#.#.*#/###.#.###/#########',
  '#########/#E.##...#/#..*.*..#/##S##.###/#.##..#.#/##...#.##/#..##.###/#.*####.#/#########',
  '#########/##.#.E.##/##*..#..#/#...#..S#/#.#..##*#/##...####/#.*####.#/#..##.#.#/#########',
  '#########/######..#/#.E....##/###....##/#...#*.##/##...####/#..#.*..#/#.S*###.#/#########',
  '#########/#*.#.E..#/##..##.##/#.#.#..##/#*#...###/#.....###/##...S#.#/##.*#####/#########',
  '#########/###E....#/#.S*#.###/#..#.*###/#....#..#/##..#...#/###...#*#/##.###.##/#########',
  '#########/#*###..##/#..#S...#/##..#...#/#.#.#..##/##......#/##.*.##*#/###E...##/#########',
  '#########/#..#.####/####E..##/#*#...###/#...#..##/#.*##..##/#..#.#.S#/###.#*..#/#########',
  '#########/##..S.#.#/#..#...##/#...##.##/#.#*##E##/#.##*.*.#/#....#..#/#.###...#/#########',
  '#########/#E.#..*##/#...#.*.#/##....###/##.#...##/#..####*#/#S#.#...#/#.......#/#########',
  '#########/##*.#..S#/#.#..#..#/##.#..*##/##...#.##/#...#...#/#E...##*#/####....#/#########',
  '#########/####S...#/##......#/#..#.####/#.#..E###/#..##..*#/##*#...##/##.#.*.##/#########',
  '#########/#..#.####/#..##...#/#.#.....#/#....S###/#E#.*#*.#/#..#.*#.#/#####...#/#########',
  '#########/#*....#S#/#..#..*.#/##..##.##/#.#..E.##/##.#.#..#/#....##.#/#.#..#.*#/#########',
  '#########/#...#*..#/#....##.#/#.S#.E*.#/#*.#....#/###....##/#.......#/#....#..#/#########'
];
  v_limits integer[] := ARRAY[9,13,16,18,22,22,22,23,23,23,23,23,23,24,24,23,24,24,24,25,25,26,26,27,29];
  v_rows text[];
  v_row text;
  v_x integer;
  v_y integer;
  v_nx integer;
  v_ny integer;
  v_dx integer;
  v_dy integer;
  v_k integer;
  v_step integer;
  v_room integer;
  v_star_mask integer;
  v_star_count integer;
  v_star_index integer;
  v_star_x integer[] := array[]::integer[];
  v_star_y integer[] := array[]::integer[];
  v_route text;
  v_symbol text;
  v_escaped boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;
  IF p_routes IS NULL OR array_length(p_routes,1) IS DISTINCT FROM 25 THEN
    RETURN false;
  END IF;
  FOR v_room IN 1..25 LOOP
    v_route := p_routes[v_room];
    IF v_route IS NULL OR length(v_route) < 1
      OR length(v_route)>v_limits[v_room]
      OR v_route !~ '^[URDL]+$' THEN
      RETURN false;
    END IF;
    v_rows := string_to_array(v_maps[v_room],'/');
    v_star_x := array[]::integer[];
    v_star_y := array[]::integer[];
    v_star_count := 0;
    v_star_mask := 0;
    v_escaped := false;
    v_x := 0;
    v_y := 0;
    FOR v_ny IN 1..9 LOOP
      v_row := v_rows[v_ny];
      FOR v_nx IN 1..9 LOOP
        v_symbol := substr(v_row,v_nx,1);
        IF v_symbol='S' THEN
          v_x := v_nx;
          v_y := v_ny;
        ELSIF v_symbol='*' THEN
          v_star_count := v_star_count+1;
          v_star_x := array_append(v_star_x,v_nx);
          v_star_y := array_append(v_star_y,v_ny);
        END IF;
      END LOOP;
    END LOOP;
    IF v_x=0 OR v_y=0 OR v_star_count<>3 THEN
      RETURN false;
    END IF;
    FOR v_step IN 1..length(v_route) LOOP
      CASE substr(v_route,v_step,1)
        WHEN 'U' THEN v_dx:=0; v_dy:=-1;
        WHEN 'R' THEN v_dx:=1; v_dy:=0;
        WHEN 'D' THEN v_dx:=0; v_dy:=1;
        WHEN 'L' THEN v_dx:=-1; v_dy:=0;
        ELSE RETURN false;
      END CASE;
      v_k:=0;
      LOOP
        v_nx:=v_x+v_dx; v_ny:=v_y+v_dy;
        IF v_nx<1 OR v_nx>9 OR v_ny<1 OR v_ny>9 THEN EXIT; END IF;
        v_symbol:=substr(v_rows[v_ny],v_nx,1);
        IF v_symbol='#' THEN EXIT; END IF;
        v_x:=v_nx; v_y:=v_ny; v_k:=v_k+1;
        IF v_symbol='*' THEN
          FOR v_star_index IN 1..3 LOOP
            IF v_star_x[v_star_index]=v_x AND v_star_y[v_star_index]=v_y THEN
              v_star_mask:=v_star_mask | (1 << (v_star_index-1));
            END IF;
          END LOOP;
        END IF;
        IF v_symbol='E' AND v_star_mask=7 THEN
          v_escaped:=true;
          EXIT;
        END IF;
      END LOOP;
      IF v_k=0 OR (v_escaped AND v_step<>length(v_route)) THEN
        RETURN false;
      END IF;
    END LOOP;
    IF NOT v_escaped OR v_star_mask<>7 THEN
      RETURN false;
    END IF;
  END LOOP;

  INSERT INTO public.crilo_escape_cosmetics (user_id) VALUES (v_user)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN true;
END;
$gold$;
REVOKE ALL ON FUNCTION public.crilo_unlock_golden_box(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crilo_unlock_golden_box(text[]) TO authenticated;
COMMENT ON FUNCTION public.crilo_unlock_golden_box(text[]) IS
 'Unlocks a cosmetic only after server-validation of all 25 sliding puzzle levels. Does not grant game scores or badges.';
