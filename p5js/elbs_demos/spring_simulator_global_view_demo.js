// spring simulator global view demo:
// javascript implementation of code that generates elbs global view positions.
// adapted from code by Tom Cortina for 15-104 course, lecture 22
// https://www.cs.cmu.edu/~tcortina/15104-f20/lectures/22-MutualInteraction.pdf

// for each spring (comprised of 2 particles)
//   get the rest length from the larger rtt of the 2 endpoints
//   calculate displacement in x and y direction
//   calculate force on spring
//   add to endpoints
// for each particle
//   move proportional to amount of force on particle

let cell_size = 40;
const CELLS_WIDE = 18;
const CELLS_HIGH = 13;

var nl;
const force_factor = 0.1;

class ConnectionInfo{
  constructor(ID, rtt){
    this.ID = ID;
    this.rtt = rtt;
  }
  
  get_rtt(){ return this.rtt; }
  get_ID(){ return this.ID; }
}


function setup() {
  createCanvas(cell_size * CELLS_WIDE, cell_size * CELLS_HIGH);
  nl = new NodesList(
    [new ConnectionInfo(0, 100),
    new ConnectionInfo(1, 100),
    new ConnectionInfo(2, 200),
     new ConnectionInfo(3, 300),
     new ConnectionInfo(5, 1800),
    new ConnectionInfo(4, 300)]
  );
  textSize(20);
  frameRate(20);
}



class Node{
  constructor(rtt, ID, init_x, init_y){
    this.rtt = rtt;
    this.ID = ID;
    this.x = init_x;
    this.y = init_y;
    this.force_x = 0;
    this.force_y = 0;
  }
  
  update_force(forcex, forcey){
    this.force_x += forcex;
    this.force_y += forcey;
  }
  
  update_displacement(){
    this.x += this.force_x * force_factor;
    this.y += this.force_y * force_factor;
  }
  
  zero_force(){
    this.force_x = 0;
    this.force_y = 0;
  }
}

class NodesList{
  constructor(conninfos_list){
    this.nodes = [];
    this.prev_tf_x = 0;
    this.prev_tf_y = 0;
    
    // arrange nodes in circle
    for (let i=0; i<conninfos_list.length; i++){      
      let angle = (i / conninfos_list.length) * (Math.PI * 2);
      let init_x = ((cell_size * CELLS_WIDE)/2.0) + (10.0 * Math.cos(angle));
      let init_y = ((cell_size * CELLS_HIGH)/2.0) + (10.0 * Math.sin(angle));
      this.nodes.push(new Node(conninfos_list[i].get_rtt(), conninfos_list[i].get_ID(), init_x, init_y));
    }
    
    // equilibrium
    this.iterations_to_equilibrium = 0;
    this.num_static_iters = 0;
    this.is_static = false;
    this.static_iters_to_eq = 300;
  
  }
  
  update_all_displacements(){
    for (let i=0; i<this.nodes.length; i++){
      this.nodes[i].update_displacement();
      this.nodes[i].x = constrain(this.nodes[i].x, 50, (cell_size * CELLS_WIDE)-50);
      this.nodes[i].y = constrain(this.nodes[i].y, 50, (cell_size * CELLS_HIGH)-50);
    }
     // for (let i=0; i<this.nodes.length; i++){
      //   this.nodes[i].x = constrain(this.nodes[i].x, 50, (cell_size * CELLS_WIDE)-50);
      //   this.nodes[i].y = constrain(this.nodes[i].y, 50, (cell_size * CELLS_HIGH)-50);
      // }
  }
  
  zero_all_forces(){
    for (let i=0; i<this.nodes.length; i++){
      this.nodes[i].zero_force();
    }
    
  }
  
  update_all_forces(){
    // update the forces for every pair of particles (every spring)
    let total_force_x = 0;
    let total_force_y = 0;
    
    
    for (let i=0; i<this.nodes.length; i++){
      for (let j=0; j<i; j++){  
        
        // get the rest length from the larger rtt of the 2 particles
        let rest_length = max(this.nodes[i].rtt, this.nodes[j].rtt);
        // calculate displacement in x and y direction
        let dx = this.nodes[i].x - this.nodes[j].x;
        let dy = this.nodes[i].y - this.nodes[j].y;
        let current_length = dist(this.nodes[i].x, this.nodes[i].y,
                        this.nodes[j].x, this.nodes[j].y);
        
        let angle = Math.asin(dy/current_length);
        // when nodes are far apart, force drops off by 1/distance
        let spring_force = (current_length - rest_length) / (Math.max(current_length, 1.0));
        let Fs_x = spring_force*Math.cos(angle);
        let Fs_y = spring_force*Math.sin(angle);
  
        this.nodes[j].update_force(Fs_x, Fs_y);
        this.nodes[i].update_force(-1.0*Fs_x, -1.0*Fs_y);
  
        total_force_x += abs(spring_force*Math.cos(angle))
        total_force_y += abs(spring_force*Math.sin(angle));
        
      }
    }
    
    if (abs(this.prev_tf_x.toFixed(2) - total_force_x.toFixed(2)) <= 1.0 &&
         abs(this.prev_tf_y.toFixed(2) - total_force_y.toFixed(2)) <= 1.0){
        this.num_static_iters += 1;
        if (this.num_static_iters > this.static_iters_to_eq){
          this.is_static = true;    
        }
    }else{
      console.log("reset")
      this.num_static_iters = 0;
    }

    this.prev_tf_x = total_force_x;
    this.prev_tf_y = total_force_y;
    this.iterations_to_equilibrium += 1;
    
  }
  
  draw(){
    stroke(0);
    fill(0);
    
    if (!this.is_static){
      this.update_all_forces();
      this.update_all_displacements();
      this.zero_all_forces();

      // for (let i=0; i<this.nodes.length; i++){
      //   this.nodes[i].x = constrain(this.nodes[i].x, 50, (cell_size * CELLS_WIDE)-50);
      //   this.nodes[i].y = constrain(this.nodes[i].y, 50, (cell_size * CELLS_HIGH)-50);
      // }
      
    }
    
    text("F_(x,y) on system: (" + this.prev_tf_x.toFixed(2) + ", " + this.prev_tf_y.toFixed(2) + ")", 
                                                                20, 30);
    
    
    text(this.num_static_iters + " static iterations so far", 20, 70);
    
    text(this.iterations_to_equilibrium + " iterations to equilibrium", 20, 110);
    
    
    for (let i=0; i<this.nodes.length; i++){
      for (let j=0; j<i; j++){
        let mid_x = (this.nodes[i].x + this.nodes[j].x) / 2.0;
        let mid_y = (this.nodes[i].y + this.nodes[j].y) / 2.0;
        let dist_ = dist(this.nodes[i].x, this.nodes[i].y,
                        this.nodes[j].x, this.nodes[j].y);
        line(this.nodes[i].x, this.nodes[i].y, 
            this.nodes[j].x, this.nodes[j].y);
        text(dist_.toFixed(1), mid_x, mid_y);
        
      }
    }
    
    for (let i=0; i<this.nodes.length; i++){
      circle(this.nodes[i].x, this.nodes[i].y, 10)
      text(this.nodes[i].ID + ": " + this.nodes[i].rtt.toFixed(1), this.nodes[i].x, this.nodes[i].y);
    }
      
  }
  
}

function draw() {
  background(220);
  nl.draw()
}