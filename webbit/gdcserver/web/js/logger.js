/**
 * Logger class
 */
 class Logger {
    constructor(maxItem) {
  //    this.maxItem_ = maxItem || 5;
  //    this.eContainer_ = document.createElement('div');
  //    this.eContainer_.className = 'was-logger-container';
    }
  
  //  getElement() {
  //    return this.eContainer_;
  //  }
  
    post(message) {
  //    const newDiv = document.createElement('div');
  //    newDiv.textContent = message;
  //    this.eContainer_.insertBefore(newDiv, this.eContainer_.firstChild);
  //    if (this.eContainer_.children.length > this.maxItem_) {
  //      this.eContainer_.removeChild(this.eContainer_.lastChild);
  //    }
        console.log("Logger: " + message);
    }
  
    clear() {
  //    this.eContainer_.innerHTML = '';
    }
  }
  