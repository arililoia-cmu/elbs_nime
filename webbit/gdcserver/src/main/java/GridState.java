import java.util.*;

public class GridState {
    public int grid_dim;
    public int bijection_value;
    public double force_factor;
    public final double space_width = 1000.0;
    public final double space_height = 1000.0;
    public Map<Integer, Set<Integer>> occupiedCoordsBijections;
    private double cell_size;
    private int mapSize;
    private Node[] nodesOrdered;

    public GridState(int grid_dim, int bijection_value) {
       this.grid_dim = grid_dim;
       this.bijection_value = bijection_value;
       this.occupiedCoordsBijections = new HashMap<>();
    }
    
    public class DrawCoordinate{
        public double x;
        public double y;

        public DrawCoordinate(double x, double y){
            this.x = x;
            this.y = y;
        }

        // reference: https://www.geeksforgeeks.org/overriding-equals-method-in-java/
        @Override
        public boolean equals(Object o){
            if (this == o){ return true; }
            if (!(o instanceof GridCoordinate)){ return false; }
            GridCoordinate c = (GridCoordinate) o;
            return Double.compare(this.x, c.x) == 0 &&
                    Double.compare(this.y, c.y) == 0;
        }

        @Override
        public int hashCode() {
            return Objects.hash(this.x, this.y);
        }
    }

    public GridCoordinate draw_to_grid_coord(DrawCoordinate dc, double grid_x, double grid_y){
        int x = (int)(Math.round(((1 * dc.x) - (1 * grid_x)) / this.cell_size));
        int y = (int)(Math.round(((1 * dc.y) - (1 * grid_y)) / this.cell_size));
        return new GridCoordinate(x, y);
    }

    public class Node{
        public double tt;
        public int ID;
        public DrawCoordinate dc;
        public double force_x = 0;
        public double force_y = 0;
        public GridCoordinate gc = new GridCoordinate(-1,-1);
        public GridCoordinate tgc = new GridCoordinate(-1,-1);
        
        public Node(double tt, int ID, double init_x, double init_y){
            this.tt = tt;
            this.ID = ID;
            this.dc = new DrawCoordinate(init_x, init_y);
        }

        public double getTT(){ return this.tt; }
        public int getID() { return this.ID; }
        public GridCoordinate getGC(){ return this.gc; }
        public DrawCoordinate getDC(){ return this.dc; }

        public void update_force(double forcex, double forcey){
            this.force_x += forcex;
            this.force_y += forcey;

        }

        public void update_displacement(){
            this.dc.x += this.force_x * force_factor;
            this.dc.y += this.force_y * force_factor;
        }

        public void zero_force(){
            this.force_x = 0;
            this.force_y = 0;
        }

    }

    private void update_all_displacements(){
        for (Node n : this.nodesOrdered) {
            n.update_displacement();
        }
    }

    private boolean check_valid_grid_coord(int gx, int gy, Set<Integer> current_set){
        int bj_val = ((gx+1)*this.bijection_value) + (gy+1);
        return gx <= this.grid_dim && gy <= this.grid_dim &&
                gx >= 0 && gy >= 0 && !current_set.contains(bj_val);
    }

    private GridCoordinate check_correct_duplicate_bijection(GridCoordinate gc, Set<Integer> current_set){
        for (int num=1; num<40; num++){
            for (int i1=num; i1>0; i1--){
                int i2 = Math.abs(i1-num);
                if (this.check_valid_grid_coord(gc.x + i2, gc.y + i1, current_set)){ return new GridCoordinate(gc.x + i2, gc.y + i1); }
                if (this.check_valid_grid_coord(gc.x + i1, gc.y - i2, current_set)){ return new GridCoordinate(gc.x + i1, gc.y - i2); }
                if (this.check_valid_grid_coord(gc.x - i1, gc.y + i2, current_set)){ return new GridCoordinate(gc.x - i1, gc.y + i2); }
                if (this.check_valid_grid_coord(gc.x - i2, gc.y - i1, current_set)){ return new GridCoordinate(gc.x - i2, gc.y - i1); }
            }
        }
        return new GridCoordinate(0,0);
    }

    // TODO: move bijection checking out of this - we don't need it until the
    // TODO: end if we're not displaying things
    // TODO: or maybe move the entire thing to the end? no force updating is done here
    private void recalculate_grid_coords(){
        double min_x = Double.POSITIVE_INFINITY;
        double min_y = Double.POSITIVE_INFINITY;
        double max_x = Double.NEGATIVE_INFINITY;
        double max_y = Double.NEGATIVE_INFINITY;
        for (Node n : this.nodesOrdered) {
            if (n.dc.x < min_x ){ min_x = n.dc.x; }
            if (n.dc.y < min_y ){ min_y = n.dc.y; }
            if (n.dc.x > max_x ){ max_x = n.dc.x; }
            if (n.dc.y > max_y ){ max_y = n.dc.y; }
        }

        double bb_width = Math.ceil(Math.max((max_x - min_x), (max_y - min_y)) / this.grid_dim) * this.grid_dim;
        this.cell_size = bb_width / grid_dim;

        // generate temporary set of points where we don't check for conflicts
        // we get all the grid coords first so we don't put something in the perfect
        // place for another thing before it's placed

        for (Node n : this.nodesOrdered) {
            n.tgc = this.draw_to_grid_coord(n.dc, min_x, min_y);
        }

        Set<Integer> bijections_set = new HashSet<>();

        System.out.println(" - ");
        // for every node n:
        //      calculate the grid coordinate of n and its bijection
        //      keep track of bijections to IDs (and duplicates) in temporary map
        for (Node n : this.nodesOrdered) {
            int bj = ((n.tgc.x+1) * this.bijection_value) + (n.tgc.y+1);
            if (!bijections_set.contains(bj)){
                n.gc.x = n.tgc.x;
                n.gc.y = n.tgc.y;
                bijections_set.add(bj);
            }else{
                GridCoordinate ccd = this.check_correct_duplicate_bijection(n.tgc, bijections_set);
                n.gc = ccd;
                int bj2 = ((ccd.x+1) * this.bijection_value) + (ccd.y+1);
                bijections_set.add(bj2);
            }
            System.out.println(n.getID() + ": " + n.getGC().x + ", " + n.getGC().y + " from " +  n.getDC().x + ", " + n.getDC().y);
        }
    }

    public void zero_all_forces(){
        for (Node n : this.nodesOrdered) {
            n.zero_force();
        }
    }

    public void update_all_forces(){
        // update the forces for every pair of particles (every spring)

        for (int i=0; i<this.mapSize; i++){
            for (int j=0; j<i; j++){

                double rest_length = this.nodesOrdered[i].getTT() + this.nodesOrdered[j].getTT();
                double dx = this.nodesOrdered[i].dc.x - this.nodesOrdered[j].dc.x;
                double dy = this.nodesOrdered[i].dc.y - this.nodesOrdered[j].dc.y;
                double current_length = Math.sqrt((dx*dx) + (dy*dy));

                if (current_length >= 1.0){
                    double cr_dir = (rest_length >= current_length) ? 1.0 : -1.0;
                    double in_x = dx/current_length;
                    double in_y = dy/current_length;
                    double spring_force = Math.abs(current_length - rest_length) / rest_length;
                    double Fs_x = spring_force*in_x;
                    double Fs_y = spring_force*in_y;
                    this.nodesOrdered[i].update_force(cr_dir * Fs_x, cr_dir * Fs_y);
                    this.nodesOrdered[j].update_force(-1.0 * cr_dir * Fs_x, -1.0 * cr_dir * Fs_y);
                }
            }
        }

        for (Node n : this.nodesOrdered) {
            System.out.println("force on node " + n.getID() + ": " + n.force_x + ", " + n.force_y);
        }



    }

    public HashMap<org.webbitserver.WebSocketConnection, GridCoordinate>
        generateGridCoords(Map<org.webbitserver.WebSocketConnection, ConnectionInfo> connectionsMap){

        // generate nodes
        this.mapSize = connectionsMap.size();
        double rad = 200.0 / (2.0 * Math.sin(Math.PI / this.mapSize));

        // sort connection_infos in increasing TT order - makes resulting global view
        // configuration look better
        java.util.List<Map.Entry<org.webbitserver.WebSocketConnection, ConnectionInfo>> connectionsMapEntryList
                = new java.util.ArrayList<>(connectionsMap.entrySet());
        connectionsMapEntryList.sort(Comparator.comparing(entry -> entry.getValue()));

        // generate arrays of connections and nodes ordered - we can index pairs of elements of
        // arrays more efficiently than pairs of values (in key-value pairs) in a map
        org.webbitserver.WebSocketConnection[] connectionsOrdered
                = new org.webbitserver.WebSocketConnection[this.mapSize];
        this.nodesOrdered = new Node[this.mapSize];

        // generate angles and declare nodes
        double angle;
        double init_x;
        double init_y;
        System.out.println("rad: " + rad);
        int iter = 0;
        for (Map.Entry<org.webbitserver.WebSocketConnection, ConnectionInfo> entry : connectionsMapEntryList) {
            System.out.println("iter: " + iter);
            connectionsOrdered[iter] = entry.getKey();
            ConnectionInfo conn = entry.getValue();
            System.out.println(" (iter / this.mapSize): " +  (iter / this.mapSize));
            angle = ((double)iter / (double)this.mapSize) * (Math.PI * 2.0) + 0.5;
            System.out.println("angle: " + angle);
            init_x = (this.space_width/2.0) + (rad * Math.cos(angle));
            init_y = (this.space_height/2.0) + (rad * Math.sin(angle));
            System.out.println("init_x: " + init_x);
            System.out.println("init_y: " + init_y);
            this.nodesOrdered[iter] = new Node(conn.getTT()*100.0, conn.getID(), init_x, init_y);
            iter += 1;
        }

        // set internal variables
        this.force_factor = 1.0 / this.mapSize;

        int num_iters = 0;
        int max_iters = 2000;
        while (num_iters < max_iters) {
            this.update_all_forces();
            this.update_all_displacements();
            this.recalculate_grid_coords();
            this.zero_all_forces();
            num_iters += 1;
        }

        // after we've reached max number of iterations
        HashMap<org.webbitserver.WebSocketConnection, GridCoordinate> connectionsGCsMap =
                new HashMap<org.webbitserver.WebSocketConnection, GridCoordinate>();

        for (int n=0; n<this.mapSize; n++){
            connectionsGCsMap.put(connectionsOrdered[n], this.nodesOrdered[n].getGC());
        }

        return connectionsGCsMap;

    }
   

}


